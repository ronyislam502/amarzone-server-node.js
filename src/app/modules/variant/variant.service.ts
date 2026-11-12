import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Product } from "../product/product.model";
import { TVariant } from "./variant.interface";
import { TImageFiles } from "../../interface/image.interface";
import { Variant } from "./variant.model";
import { generateSKU } from "../../utilities/generateSku";
import { generateASIN } from "../../utilities/generateAsin";
import QueryBuilder from "../../builder/queryBuilder";
import { getSuspendedVendorIds } from "../../utilities/buyBox";
import { Inventory } from "../inventory/inventory.model";
import { Types } from "mongoose";
import { ProductReview } from "../productReview/productReview.model";
import { Department } from "../department/department.model";
import { Category } from "../category/category.model";



const createVariantIntoDB = async (
    images: TImageFiles,
    payload: TVariant
) => {
    // Check product exists and get department/category information
    const product = await Product.findById(payload.product)
        .populate("department")
        .populate("category");

    if (!product) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "This product was not found"
        );
    }

    // Validate department
    const department = product.department;

    if (!department) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "This product department was not found"
        );
    }

    // Validate category
    const category = product.category;

    if (!category) {
        throw new AppError(
            httpStatus.NOT_FOUND,
            "This product category was not found"
        );
    }

    // Get existing variants for this product
    const existingVariants = await Variant.find({
        product: payload.product,
        isDeleted: { $ne: true },
    });

    // Maximum 2 variants per product
    if (existingVariants.length >= 2) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "This product already has 2 variants"
        );
    }

    // Check duplicate attributes
    const isDuplicateAttributes = existingVariants.some(
        (existingVariant) => {
            if (
                existingVariant.attributes.length !==
                payload.attributes.length
            ) {
                return false;
            }

            return existingVariant.attributes.every(
                (existingAttribute) =>
                    payload.attributes.some(
                        (newAttribute) =>
                            newAttribute.type === existingAttribute.type &&
                            newAttribute.value === existingAttribute.value
                    )
            );
        }
    );

    if (isDuplicateAttributes) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Variant with the same attributes already exists for this product"
        );
    }

    // Add uploaded images
    if (images?.images?.length) {
        payload.images = images.images.map((img) => img.path);
    }

    // Validate images
    if (!payload.images || payload.images.length === 0) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "At least one variant image is required"
        );
    }

    // Check duplicate images inside the new variant
    const uniqueImages = new Set(payload.images);

    if (uniqueImages.size !== payload.images.length) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Duplicate images are not allowed in a variant"
        );
    }

    // Check whether any image is already used by another variant
    const imageAlreadyExists = existingVariants.some((existingVariant) =>
        existingVariant.images.some((existingImage) =>
            payload.images.includes(existingImage)
        )
    );

    if (imageAlreadyExists) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "One or more variant images are already used by another variant of this product"
        );
    }

    // Generate ASIN
    payload.asin = await generateASIN(
        (department as any).name,
        (category as any).name
    );

    // Generate SKU
    payload.sku = generateSKU(
        payload.asin,
        payload.attributes
    );

    // Create variant
    const result = await Variant.create(payload);

    return result;
};

const allVariantsByProductFromDB = async (id: string, query: Record<string, unknown>) => {
    const isProductExists = await Product.findById(id);
    if (!isProductExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this product not found");
    }
    const variantProductQuery = new QueryBuilder(
        Variant.find({ product: isProductExists._id }).populate({
            path: "product",
            populate: [
                { path: "department" },
                { path: "category" }
            ]
        }),
        query
    )
        .search([""])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await variantProductQuery.countTotal();
    const data = await variantProductQuery.modelQuery;

    return { meta, data }
}


const allVariantsProductsFromDB = async (query: Record<string, unknown>) => {
    // 1. Initialize QueryBuilder on the Variant model
    const variantProductQuery = new QueryBuilder(
        Variant.find({ isDeleted: { $ne: true } }).populate({
            path: "product",
            populate: [
                { path: "department" },
                { path: "category" }
            ]
        }),
        query
    )
        // Note: Configure your search fields here matching Variant fields 
        // or product fields if populated, e.g. ["asin", "sku"] or custom filters
        .search(["asin", "sku"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await variantProductQuery.countTotal();
    const variants = await variantProductQuery.modelQuery;

    if (!variants || variants.length === 0) {
        return { meta, data: [] };
    }

    const variantIds = variants.map((v: any) => v._id);
    const variantAsins = variants.map((v: any) => v.asin).filter(Boolean);

    // 2. Fetch pricing and buy box winner status from inventory (excluding suspended vendors)
    const suspendedVendorIds = await getSuspendedVendorIds();
    const inventoryListings = await Inventory.find({
        $or: [
            { variant: { $in: variantIds } },
            { asin: { $in: variantAsins } },
        ],
        "seller.vendor": { $nin: suspendedVendorIds },
        isDeleted: { $ne: true },
        "seller.isStock": { $ne: false },
        "seller.price": { $gt: 0 },
    })
        .select("variant asin seller.price seller.isBuyBoxWinner seller.vendor")
        .lean();

    // Index inventory listings by variant ID and ASIN
    const listingsByVariantId = new Map<string, any[]>();
    const listingsByAsin = new Map<string, any[]>();

    for (const listing of inventoryListings) {
        if (listing.variant) {
            const vKey = listing.variant.toString();
            if (!listingsByVariantId.has(vKey)) {
                listingsByVariantId.set(vKey, []);
            }
            listingsByVariantId.get(vKey)!.push(listing);
        }
        if (listing.asin) {
            const aKey = listing.asin;
            if (!listingsByAsin.has(aKey)) {
                listingsByAsin.set(aKey, []);
            }
            listingsByAsin.get(aKey)!.push(listing);
        }
    }

    // 3. Fetch review ratings for variants from ProductReview
    const variantObjectIds = variants.map((v: any) => new Types.ObjectId(v._id.toString()));
    const variantIdStrings = variants.map((v: any) => v._id.toString());
    const reviewStats = await ProductReview.aggregate([
        {
            $match: {
                variant: { $in: [...variantObjectIds, ...variantIdStrings] },
            },
        },
        {
            $group: {
                _id: "$variant",
                averageRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 },
            },
        },
    ]);

    const ratingsByVariantId = new Map<string, number>();
    for (const stat of reviewStats) {
        if (stat._id) {
            const avg = typeof stat.averageRating === "number"
                ? Math.round(stat.averageRating * 10) / 10
                : 0;
            ratingsByVariantId.set(stat._id.toString(), parseFloat(avg.toFixed(2)));
        }
    }

    // 4. Enrich each variant with pricing, buy box status, and ratings, then flatten structure
    const flattenedProducts = variants.map((variantDoc: any) => {
        const variant = variantDoc?.toObject ? variantDoc.toObject() : variantDoc;
        const vIdStr = variant._id.toString();
        const vAsin = variant.asin;

        const matchedListingsMap = new Map<string, any>();
        if (listingsByVariantId.has(vIdStr)) {
            for (const item of listingsByVariantId.get(vIdStr)!) {
                matchedListingsMap.set(item._id.toString(), item);
            }
        }
        if (vAsin && listingsByAsin.has(vAsin)) {
            for (const item of listingsByAsin.get(vAsin)!) {
                matchedListingsMap.set(item._id.toString(), item);
            }
        }
        const variantListings = Array.from(matchedListingsMap.values());

        // Filter valid in-stock listings with positive prices
        const validListings = variantListings.filter(
            (l: any) => typeof l.seller?.price === "number" && !isNaN(l.seller.price) && l.seller.price > 0
        );

        // Find the lowest-priced seller listing
        let lowestPriceListing: any = null;
        for (const listing of validListings) {
            if (!lowestPriceListing || listing.seller.price < lowestPriceListing.seller.price) {
                lowestPriceListing = listing;
            }
        }

        // Find the Buy Box Winner listing
        const buyBoxWinner = validListings.find(
            (l: any) => l.seller?.isBuyBoxWinner === true
        );

        const isEligible = typeof variant.isBuyBoxEligible === "boolean"
            ? variant.isBuyBoxEligible
            : Boolean(buyBoxWinner);

        // Select listing based on eligibility rules
        let selectedListing: any = null;
        if (isEligible) {
            selectedListing = buyBoxWinner || lowestPriceListing;
        } else {
            selectedListing = lowestPriceListing;
        }

        const price: number | null = selectedListing?.seller?.price ?? null;
        const vendorId = selectedListing?.seller?.vendor ?? null;
        const rating = ratingsByVariantId.get(vIdStr) ?? 0;

        // Extract and separate the populated product info
        const { product, ...variantInfo } = variant;
        const productObj = product?.toObject ? product.toObject() : product;

        return {
            ...productObj,
            ...variantInfo,
            productId: productObj?._id,
            _id: variant._id,
            price,
            rating,
            isBuyBoxEligible: isEligible,
            vendorId,
        };
    });

    return {
        meta,
        data: flattenedProducts,
    };
};



const allVariantsProductsByDepartmentFromDB = async (id: string, query: Record<string, unknown>) => {

    const isDepartment = await Department.findById(id);

    if (!isDepartment) {
        throw new AppError(httpStatus.NOT_FOUND, "this department not found");
    }

    const productIdsInDepartment = await Product.find({ department: isDepartment?._id, isDeleted: { $ne: true } }).distinct('_id');
    // 1. Initialize QueryBuilder on the Variant model
    const variantProductQuery = new QueryBuilder(
        Variant.find({
            product: { $in: productIdsInDepartment },
            isDeleted: { $ne: true }
        }).populate({
            path: "product",
            populate: [
                { path: "department" },
                { path: "category" }
            ]
        }),
        query
    )
        // Note: Configure your search fields here matching Variant fields 
        // or product fields if populated, e.g. ["asin", "sku"] or custom filters
        .search(["asin", "sku"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await variantProductQuery.countTotal();
    const variants = await variantProductQuery.modelQuery;

    if (!variants || variants.length === 0) {
        return { meta, data: [] };
    }

    const variantIds = variants.map((v: any) => v._id);
    const variantAsins = variants.map((v: any) => v.asin).filter(Boolean);

    // 2. Fetch pricing and buy box winner status from inventory (excluding suspended vendors)
    const suspendedVendorIds = await getSuspendedVendorIds();
    const inventoryListings = await Inventory.find({
        $or: [
            { variant: { $in: variantIds } },
            { asin: { $in: variantAsins } },
        ],
        "seller.vendor": { $nin: suspendedVendorIds },
        isDeleted: { $ne: true },
        "seller.isStock": { $ne: false },
        "seller.price": { $gt: 0 },
    })
        .select("variant asin seller.price seller.isBuyBoxWinner seller.vendor")
        .lean();

    // Index inventory listings by variant ID and ASIN
    const listingsByVariantId = new Map<string, any[]>();
    const listingsByAsin = new Map<string, any[]>();

    for (const listing of inventoryListings) {
        if (listing.variant) {
            const vKey = listing.variant.toString();
            if (!listingsByVariantId.has(vKey)) {
                listingsByVariantId.set(vKey, []);
            }
            listingsByVariantId.get(vKey)!.push(listing);
        }
        if (listing.asin) {
            const aKey = listing.asin;
            if (!listingsByAsin.has(aKey)) {
                listingsByAsin.set(aKey, []);
            }
            listingsByAsin.get(aKey)!.push(listing);
        }
    }

    // 3. Fetch review ratings for variants from ProductReview
    const variantObjectIds = variants.map((v: any) => new Types.ObjectId(v._id.toString()));
    const variantIdStrings = variants.map((v: any) => v._id.toString());
    const reviewStats = await ProductReview.aggregate([
        {
            $match: {
                variant: { $in: [...variantObjectIds, ...variantIdStrings] },
            },
        },
        {
            $group: {
                _id: "$variant",
                averageRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 },
            },
        },
    ]);

    const ratingsByVariantId = new Map<string, number>();
    for (const stat of reviewStats) {
        if (stat._id) {
            const avg = typeof stat.averageRating === "number"
                ? Math.round(stat.averageRating * 10) / 10
                : 0;
            ratingsByVariantId.set(stat._id.toString(), parseFloat(avg.toFixed(2)));
        }
    }

    // 4. Enrich each variant with pricing, buy box status, and ratings, then flatten structure
    const flattenedProducts = variants.map((variantDoc: any) => {
        const variant = variantDoc?.toObject ? variantDoc.toObject() : variantDoc;
        const vIdStr = variant._id.toString();
        const vAsin = variant.asin;

        const matchedListingsMap = new Map<string, any>();
        if (listingsByVariantId.has(vIdStr)) {
            for (const item of listingsByVariantId.get(vIdStr)!) {
                matchedListingsMap.set(item._id.toString(), item);
            }
        }
        if (vAsin && listingsByAsin.has(vAsin)) {
            for (const item of listingsByAsin.get(vAsin)!) {
                matchedListingsMap.set(item._id.toString(), item);
            }
        }
        const variantListings = Array.from(matchedListingsMap.values());

        // Filter valid in-stock listings with positive prices
        const validListings = variantListings.filter(
            (l: any) => typeof l.seller?.price === "number" && !isNaN(l.seller.price) && l.seller.price > 0
        );

        // Find the lowest-priced seller listing
        let lowestPriceListing: any = null;
        for (const listing of validListings) {
            if (!lowestPriceListing || listing.seller.price < lowestPriceListing.seller.price) {
                lowestPriceListing = listing;
            }
        }

        // Find the Buy Box Winner listing
        const buyBoxWinner = validListings.find(
            (l: any) => l.seller?.isBuyBoxWinner === true
        );

        const isEligible = typeof variant.isBuyBoxEligible === "boolean"
            ? variant.isBuyBoxEligible
            : Boolean(buyBoxWinner);

        // Select listing based on eligibility rules
        let selectedListing: any = null;
        if (isEligible) {
            selectedListing = buyBoxWinner || lowestPriceListing;
        } else {
            selectedListing = lowestPriceListing;
        }

        const price: number | null = selectedListing?.seller?.price ?? null;
        const vendorId = selectedListing?.seller?.vendor ?? null;
        const rating = ratingsByVariantId.get(vIdStr) ?? 0;

        // Extract and separate the populated product info
        const { product, ...variantInfo } = variant;
        const productObj = product?.toObject ? product.toObject() : product;

        return {
            ...productObj,
            ...variantInfo,
            productId: productObj?._id,
            _id: variant._id,
            price,
            rating,
            isBuyBoxEligible: isEligible,
            vendorId,
        };
    });

    return {
        meta,
        data: flattenedProducts,
    };
};


const allVariantsProductsByCategoryFromDB = async (id: string, query: Record<string, unknown>) => {

    const isCategory = await Category.findById(id);

    if (!isCategory) {
        throw new AppError(httpStatus.NOT_FOUND, "this category not found");
    }


    const productIdsInCategory = await Product.find({ category: isCategory?._id, isDeleted: { $ne: true } }).distinct('_id');
    // 1. Initialize QueryBuilder on the Variant model
    const variantProductQuery = new QueryBuilder(
        Variant.find({
            product: { $in: productIdsInCategory },
            isDeleted: { $ne: true }
        }).populate({
            path: "product",
            populate: [
                { path: "department" },
                { path: "category" }
            ]
        }),
        query
    )
        // Note: Configure your search fields here matching Variant fields 
        // or product fields if populated, e.g. ["asin", "sku"] or custom filters
        .search(["asin", "sku"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await variantProductQuery.countTotal();
    const variants = await variantProductQuery.modelQuery;

    if (!variants || variants.length === 0) {
        return { meta, data: [] };
    }

    const variantIds = variants.map((v: any) => v._id);
    const variantAsins = variants.map((v: any) => v.asin).filter(Boolean);

    // 2. Fetch pricing and buy box winner status from inventory (excluding suspended vendors)
    const suspendedVendorIds = await getSuspendedVendorIds();
    const inventoryListings = await Inventory.find({
        $or: [
            { variant: { $in: variantIds } },
            { asin: { $in: variantAsins } },
        ],
        "seller.vendor": { $nin: suspendedVendorIds },
        isDeleted: { $ne: true },
        "seller.isStock": { $ne: false },
        "seller.price": { $gt: 0 },
    })
        .select("variant asin seller.price seller.isBuyBoxWinner seller.vendor")
        .lean();

    // Index inventory listings by variant ID and ASIN
    const listingsByVariantId = new Map<string, any[]>();
    const listingsByAsin = new Map<string, any[]>();

    for (const listing of inventoryListings) {
        if (listing.variant) {
            const vKey = listing.variant.toString();
            if (!listingsByVariantId.has(vKey)) {
                listingsByVariantId.set(vKey, []);
            }
            listingsByVariantId.get(vKey)!.push(listing);
        }
        if (listing.asin) {
            const aKey = listing.asin;
            if (!listingsByAsin.has(aKey)) {
                listingsByAsin.set(aKey, []);
            }
            listingsByAsin.get(aKey)!.push(listing);
        }
    }

    // 3. Fetch review ratings for variants from ProductReview
    const variantObjectIds = variants.map((v: any) => new Types.ObjectId(v._id.toString()));
    const variantIdStrings = variants.map((v: any) => v._id.toString());
    const reviewStats = await ProductReview.aggregate([
        {
            $match: {
                variant: { $in: [...variantObjectIds, ...variantIdStrings] },
            },
        },
        {
            $group: {
                _id: "$variant",
                averageRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 },
            },
        },
    ]);

    const ratingsByVariantId = new Map<string, number>();
    for (const stat of reviewStats) {
        if (stat._id) {
            const avg = typeof stat.averageRating === "number"
                ? Math.round(stat.averageRating * 10) / 10
                : 0;
            ratingsByVariantId.set(stat._id.toString(), parseFloat(avg.toFixed(2)));
        }
    }

    // 4. Enrich each variant with pricing, buy box status, and ratings, then flatten structure
    const flattenedProducts = variants.map((variantDoc: any) => {
        const variant = variantDoc?.toObject ? variantDoc.toObject() : variantDoc;
        const vIdStr = variant._id.toString();
        const vAsin = variant.asin;

        const matchedListingsMap = new Map<string, any>();
        if (listingsByVariantId.has(vIdStr)) {
            for (const item of listingsByVariantId.get(vIdStr)!) {
                matchedListingsMap.set(item._id.toString(), item);
            }
        }
        if (vAsin && listingsByAsin.has(vAsin)) {
            for (const item of listingsByAsin.get(vAsin)!) {
                matchedListingsMap.set(item._id.toString(), item);
            }
        }
        const variantListings = Array.from(matchedListingsMap.values());

        // Filter valid in-stock listings with positive prices
        const validListings = variantListings.filter(
            (l: any) => typeof l.seller?.price === "number" && !isNaN(l.seller.price) && l.seller.price > 0
        );

        // Find the lowest-priced seller listing
        let lowestPriceListing: any = null;
        for (const listing of validListings) {
            if (!lowestPriceListing || listing.seller.price < lowestPriceListing.seller.price) {
                lowestPriceListing = listing;
            }
        }

        // Find the Buy Box Winner listing
        const buyBoxWinner = validListings.find(
            (l: any) => l.seller?.isBuyBoxWinner === true
        );

        const isEligible = typeof variant.isBuyBoxEligible === "boolean"
            ? variant.isBuyBoxEligible
            : Boolean(buyBoxWinner);

        // Select listing based on eligibility rules
        let selectedListing: any = null;
        if (isEligible) {
            selectedListing = buyBoxWinner || lowestPriceListing;
        } else {
            selectedListing = lowestPriceListing;
        }

        const price: number | null = selectedListing?.seller?.price ?? null;
        const vendorId = selectedListing?.seller?.vendor ?? null;
        const rating = ratingsByVariantId.get(vIdStr) ?? 0;

        // Extract and separate the populated product info
        const { product, ...variantInfo } = variant;
        const productObj = product?.toObject ? product.toObject() : product;

        return {
            ...productObj,
            ...variantInfo,
            productId: productObj?._id,
            _id: variant._id,
            price,
            rating,
            isBuyBoxEligible: isEligible,
            vendorId,
        };
    });

    return {
        meta,
        data: flattenedProducts,
    };
};






export const VariantServices = {
    createVariantIntoDB,
    allVariantsByProductFromDB,
    allVariantsProductsFromDB,
    allVariantsProductsByDepartmentFromDB,
    allVariantsProductsByCategoryFromDB
};