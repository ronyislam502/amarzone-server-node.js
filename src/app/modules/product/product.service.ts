import httpStatus from "http-status";
import { Product } from "./product.model";
import { TProduct } from "./product.interface";
import AppError from "../../errors/AppError";
import { Department } from "../department/department.model";
import { Category } from "../category/category.model";
import { User } from "../user/user.model";
import { JwtPayload } from "jsonwebtoken";
import { USER_ROLE, USER_STATUS } from "../../interface/common";
import { TImageFile } from "../../interface/image.interface";
import QueryBuilder from "../../builder/queryBuilder";
import { Variant } from "../variant/variant.model";
import { Inventory } from "../inventory/inventory.model";
import { ProductReview } from "../productReview/productReview.model";
import { Types } from "mongoose";
import { getSuspendedVendorIds } from "../../utilities/buyBox";

const createProductIntoDB = async (
    user: JwtPayload,
    image: TImageFile,
    payload: TProduct
) => {
    const isUserExists = await User.isUserExistsByEmail(user?.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "This user not found");
    }

    if (isUserExists.status === USER_STATUS.SUSPENDED) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "User is suspended! Cannot create product"
        );
    }

    const author = {
        role: isUserExists.role,
        name:
            isUserExists.name ||
            (isUserExists.role === USER_ROLE.SUPER_ADMIN
                ? "Super Admin"
                : "Admin"),
    };

    const isDepartment = await Department.findById(payload?.department);

    if (!isDepartment) {
        throw new AppError(httpStatus.NOT_FOUND, "Department not found");
    }

    const isCategory = await Category.findById(payload?.category);

    if (!isCategory) {
        throw new AppError(httpStatus.NOT_FOUND, "Category not found");
    }

    if (isDepartment._id.toString() !== isCategory?.department?.toString()) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Selected category does not belong to the selected department."
        );
    }

    if (image && image.path) {
        payload.thumbnail = image.path
    }

    const prodData = {
        author,
        department: isDepartment._id,
        category: isCategory._id,
        title: payload.title,
        features: payload.features,
        thumbnail: payload.thumbnail,
        brand: payload.brand,
        tags: payload.tags
    }


    const result = await Product.create(prodData);

    return result;
};



const allProductsFromDB = async (query: Record<string, unknown>) => {
    const productsQuery = new QueryBuilder(
        Product.find({ isDeleted: { $ne: true } })
            .populate("department")
            .populate("category"),
        query
    )
        .search(["title", "brand", "department", "category", "tags"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await productsQuery.countTotal();
    const data = await productsQuery.modelQuery;

    return { meta, data }
};

const updateProductIntoDB = async (
    user: JwtPayload,
    id: string,
    image: TImageFile,
    payload: Partial<TProduct>
) => {

    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "This user not found");
    }

    if (isUserExists.status === USER_STATUS.SUSPENDED) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "User is suspended! Cannot update product"
        );
    }

    const isProductExists = await Product.findById(id);

    if (!isProductExists) {
        throw new AppError(httpStatus.NOT_FOUND, "This product not found");
    };

    if (
        isUserExists.role === USER_ROLE.VENDOR &&
        isProductExists.author.name !== isUserExists.name
    ) {
        throw new AppError(
            httpStatus.UNAUTHORIZED,
            "You are not authorized to update this product"
        );
    }

    const isDepartment = await Department.findById(payload.department);
    if (!isDepartment) {
        throw new AppError(httpStatus.NOT_FOUND, "Department not found");
    }

    const isCategory = await Category.findById(payload.category);
    if (!isCategory) {
        throw new AppError(httpStatus.NOT_FOUND, "Category not found");
    }

    if (isDepartment._id.toString() !== isCategory?.department?.toString()) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Selected category does not belong to the selected department."
        );
    }

    if (image && image.path) {
        payload.thumbnail = image.path;
    }

    const updProd = {

    }

    const result = await Product.findByIdAndUpdate(isProductExists._id, payload, {
        new: true,
        runValidators: true,
    });

    return result;
};

const allProductsByDepartment = async (id: string, query: Record<string, unknown>) => {
    const isDepartment = await Department.findById(id);

    if (!isDepartment) {
        throw new AppError(httpStatus.NOT_FOUND, "this department not found");
    }

    const prodDepQuery = new QueryBuilder(Product.find({ department: isDepartment?._id }).populate("department")
        .populate("category"),
        query
    )
        .search(["title", "brand", "tags"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await prodDepQuery.countTotal();
    const products = await prodDepQuery.modelQuery;
    const productIds = products.map((product: any) => product._id);

    // Fetch all active variants for these products
    const variants = await Variant.find({
        product: { $in: productIds },
        isDeleted: { $ne: true },
    }).lean();

    const variantIds = variants.map((v: any) => v._id);
    const variantAsins = variants.map((v: any) => v.asin).filter(Boolean);

    // Fetch only pricing and buy box winner status from inventory (excluding suspended vendors)
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
        .select("variant asin seller.price seller.isBuyBoxWinner")
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

    // Fetch review ratings for variants from ProductReview
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

    // Enrich variants with calculated price and rating (no vendor/inventory metadata or buyBox/lowestPrice labels)
    const variantsByProductId = new Map<string, any[]>();
    for (const variant of variants) {
        const vIdStr = variant._id.toString();
        const vAsin = variant.asin;

        // Collect matching listings for this variant, deduplicating by _id
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

        // Extract available in-stock seller prices
        const availablePrices = variantListings
            .map((l: any) => l.seller?.price)
            .filter((p: any) => typeof p === "number" && !isNaN(p) && p > 0);

        // Find Buy Box winner if one exists
        const buyBoxWinner = variantListings.find(
            (l: any) => l.seller?.isBuyBoxWinner === true && typeof l.seller?.price === "number"
        );
        const isEligible = typeof variant.isBuyBoxEligible === "boolean"
            ? variant.isBuyBoxEligible
            : Boolean(buyBoxWinner);

        let price: number | null = null;
        if (isEligible) {
            // 1. Buy Box Eligible: price of seller currently holding the Buy Box
            if (buyBoxWinner) {
                price = buyBoxWinner.seller.price;
            } else if (availablePrices.length > 0) {
                price = Math.min(...availablePrices);
            }
        } else {
            // 2. Buy Box Ineligible: lowest available seller price
            if (availablePrices.length > 0) {
                price = Math.min(...availablePrices);
            }
        }

        const rating = ratingsByVariantId.get(vIdStr) ?? 0;

        const enrichedVariant = {
            ...variant,
            isBuyBoxEligible: isEligible,
            price,
            rating,
        };

        const prodId = variant.product.toString();
        if (!variantsByProductId.has(prodId)) {
            variantsByProductId.set(prodId, []);
        }
        variantsByProductId.get(prodId)!.push(enrichedVariant);
    }

    // Attach enriched variants to each product (price belongs strictly to variant level)
    const productsWithVariants = products.map((product: any) => {
        const productObj = product?.toObject ? product.toObject() : product;
        const productVariants = variantsByProductId.get(product._id.toString()) || [];

        return {
            ...productObj,
            variants: productVariants,
        };
    });

    return {
        meta,
        data: productsWithVariants,
    };

}


const allProductsByCategoryFromDB = async (id: string, query: Record<string, unknown>) => {
    const isCategory = await Category.findById(id);

    if (!isCategory) {
        throw new AppError(httpStatus.NOT_FOUND, "this category not found");
    }

    const prodDepQuery = new QueryBuilder(Product.find({ category: isCategory?._id }).populate("department")
        .populate("category"),
        query
    )
        .search(["title", "brand", "tags"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await prodDepQuery.countTotal();
    const products = await prodDepQuery.modelQuery;
    const productIds = products.map((product: any) => product._id);

    // Fetch all active variants for these products
    const variants = await Variant.find({
        product: { $in: productIds },
        isDeleted: { $ne: true },
    }).lean();

    const variantIds = variants.map((v: any) => v._id);
    const variantAsins = variants.map((v: any) => v.asin).filter(Boolean);

    // Fetch only pricing and buy box winner status from inventory (excluding suspended vendors)
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
        .select("variant asin seller.price seller.isBuyBoxWinner")
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

    // Fetch review ratings for variants from ProductReview
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

    // Enrich variants with calculated price and rating (no vendor/inventory metadata or buyBox/lowestPrice labels)
    const variantsByProductId = new Map<string, any[]>();
    for (const variant of variants) {
        const vIdStr = variant._id.toString();
        const vAsin = variant.asin;

        // Collect matching listings for this variant, deduplicating by _id
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

        // Extract available in-stock seller prices
        const availablePrices = variantListings
            .map((l: any) => l.seller?.price)
            .filter((p: any) => typeof p === "number" && !isNaN(p) && p > 0);

        // Find Buy Box winner if one exists
        const buyBoxWinner = variantListings.find(
            (l: any) => l.seller?.isBuyBoxWinner === true && typeof l.seller?.price === "number"
        );
        const isEligible = typeof variant.isBuyBoxEligible === "boolean"
            ? variant.isBuyBoxEligible
            : Boolean(buyBoxWinner);

        let price: number | null = null;
        if (isEligible) {
            // 1. Buy Box Eligible: price of seller currently holding the Buy Box
            if (buyBoxWinner) {
                price = buyBoxWinner.seller.price;
            } else if (availablePrices.length > 0) {
                price = Math.min(...availablePrices);
            }
        } else {
            // 2. Buy Box Ineligible: lowest available seller price
            if (availablePrices.length > 0) {
                price = Math.min(...availablePrices);
            }
        }

        const rating = ratingsByVariantId.get(vIdStr) ?? 0;

        const enrichedVariant = {
            ...variant,
            isBuyBoxEligible: isEligible,
            price,
            rating,
        };

        const prodId = variant.product.toString();
        if (!variantsByProductId.has(prodId)) {
            variantsByProductId.set(prodId, []);
        }
        variantsByProductId.get(prodId)!.push(enrichedVariant);
    }

    // Attach enriched variants to each product (price belongs strictly to variant level)
    const productsWithVariants = products.map((product: any) => {
        const productObj = product?.toObject ? product.toObject() : product;
        const productVariants = variantsByProductId.get(product._id.toString()) || [];

        return {
            ...productObj,
            variants: productVariants,
        };
    });

    return {
        meta,
        data: productsWithVariants,
    };

}




const allVariantProductsFromDB = async (query: Record<string, unknown>) => {
    const productsQuery = new QueryBuilder(
        Product.find({ isDeleted: { $ne: true } })
            .populate("department")
            .populate("category"),
        query
    )
        .search(["title", "brand", "tags"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await productsQuery.countTotal();
    const products = await productsQuery.modelQuery;

    const productIds = products.map((product: any) => product._id);

    // 2. Fetch all active variants for these products
    const variants = await Variant.find({
        product: { $in: productIds },
        isDeleted: { $ne: true },
    }).lean();

    const variantIds = variants.map((v: any) => v._id);
    const variantAsins = variants.map((v: any) => v.asin).filter(Boolean);

    // 3. Fetch pricing and buy box winner status from inventory (excluding suspended vendors)
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
        .select("variant asin seller.price seller.isBuyBoxWinner")
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

    // 4. Fetch review ratings for variants from ProductReview
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

    // 5. Enrich variants with calculated price and rating
    const variantsByProductId = new Map<string, any[]>();
    for (const variant of variants) {
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

        const availablePrices = variantListings
            .map((l: any) => l.seller?.price)
            .filter((p: any) => typeof p === "number" && !isNaN(p) && p > 0);

        const buyBoxWinner = variantListings.find(
            (l: any) => l.seller?.isBuyBoxWinner === true && typeof l.seller?.price === "number"
        );
        const isEligible = typeof variant.isBuyBoxEligible === "boolean"
            ? variant.isBuyBoxEligible
            : Boolean(buyBoxWinner);

        let price: number | null = null;
        if (isEligible) {
            if (buyBoxWinner) {
                price = buyBoxWinner.seller.price;
            } else if (availablePrices.length > 0) {
                price = Math.min(...availablePrices);
            }
        } else {
            if (availablePrices.length > 0) {
                price = Math.min(...availablePrices);
            }
        }

        const rating = ratingsByVariantId.get(vIdStr) ?? 0;

        const enrichedVariant = {
            ...variant,
            isBuyBoxEligible: isEligible,
            price,
            rating,
        };

        const prodId = variant.product.toString();
        if (!variantsByProductId.has(prodId)) {
            variantsByProductId.set(prodId, []);
        }
        variantsByProductId.get(prodId)!.push(enrichedVariant);
    }

    // 6. Attach enriched variants to each product
    const productsWithVariants = products.map((product: any) => {
        const productObj = product?.toObject ? product.toObject() : product;
        const productVariants = variantsByProductId.get(product._id.toString()) || [];

        return {
            ...productObj,
            variants: productVariants,
        };
    });

    // 7. Flattening variants into individual items
    const flattenedProducts = productsWithVariants.flatMap((product: any) => {
        const { variants, ...productInfo } = product;

        if (!variants || variants.length === 0) {
            return [];
        }

        return variants.map((variant: any) => ({
            ...productInfo,
            productId: product._id,
            _id: variant._id,
            variantId: variant._id,
            asin: variant.asin,
            sku: variant.sku,
            attributes: variant.attributes,
            images: variant.images,
            thumbnail: variant.images?.[0] || product.thumbnail,
            price: variant.price,
            rating: variant.rating,
            isBuyBoxEligible: variant.isBuyBoxEligible,
        }));
    });

    // 8. Sothik Variant-level Total Count calculate kora pagination-er jonno
    const filteredProductIds = await Product.find(productsQuery.modelQuery.getFilter()).select('_id');
    const productIdsList = filteredProductIds.map(p => p._id);

    const totalVariants = await Variant.countDocuments({
        product: { $in: productIdsList },
        isDeleted: { $ne: true }
    });

    const updatedMeta = {
        ...meta,
        total: totalVariants,
        totalPage: Math.ceil(totalVariants / (meta.limit || 10))
    };

    return {
        meta: updatedMeta,
        data: flattenedProducts,
    };
};

const singleProductFromDB = async (id: string) => {
    const result = await Product.findById(id)
        .populate("department")
        .populate("category");

    if (!result) {
        throw new AppError(httpStatus.NOT_FOUND, "This product not found");
    }

    return result;
};


export const ProductServices = {
    createProductIntoDB,
    allProductsFromDB,
    updateProductIntoDB,
    allProductsByDepartment,
    allProductsByCategoryFromDB,
    allVariantProductsFromDB,
    singleProductFromDB
};

