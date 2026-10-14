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
import { Vendor } from "../vendor/vendor.model";
import mongoose from "mongoose";

const createProductIntoDB = async (
    user: JwtPayload,
    image: TImageFile,
    payload: TProduct
) => {
    const isUserExists = await User.isUserExistsByEmail(user?.email);
    console.log("user", isUserExists)

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

    const newProduct = {
        ...payload,
        author,
        isDeleted: false,
    };

    const result = await Product.create(newProduct);

    return result;
};


const productFromDB = async (id: string) => {
    const isProductExists = await Product.findById(id)
        .populate("department")
        .populate("category");

    if (!isProductExists || isProductExists.isDeleted) {
        throw new AppError(httpStatus.NOT_FOUND, "This product not found");
    }

    const prodObj = isProductExists.toObject();
    const pId = isProductExists._id;

    const referencedVariantIds: any[] = Array.isArray(prodObj.variants)
        ? prodObj.variants.map((v: any) => v?._id || v)
        : [];

    const variants = await Variant.find({
        $or: [
            { product: pId },
            { _id: { $in: referencedVariantIds } },
        ],
        isDeleted: { $ne: true },
    }).lean();

    const variantIds = variants.map((v) => v._id);

    const inventories = await Inventory.find({
        variant: { $in: variantIds },
        isDeleted: { $ne: true },
    })
        .populate("seller.vendor", "name email role")
        .lean();

    const inventoriesByVariantId = new Map<string, any[]>();
    const seenInventoryIds = new Set<string>();
    for (const inv of inventories) {
        const invIdStr = inv._id.toString();
        if (seenInventoryIds.has(invIdStr)) continue;
        seenInventoryIds.add(invIdStr);

        const vId = inv.variant?.toString();
        if (vId) {
            if (!inventoriesByVariantId.has(vId)) {
                inventoriesByVariantId.set(vId, []);
            }
            inventoriesByVariantId.get(vId)!.push(inv);
        }
    }

    const variantsWithInventory = variants.map((variant) => {
        const vIdStr = variant._id.toString();
        const variantInventories = inventoriesByVariantId.get(vIdStr) || [];
        return {
            ...variant,
            inventory: variantInventories,
        };
    });

    const allPrices: number[] = [];
    let hasInStock = false;
    for (const v of variantsWithInventory) {
        if (Array.isArray(v.inventory)) {
            for (const inv of v.inventory) {
                const price = inv?.seller?.price;
                if (typeof price === "number" && price > 0) {
                    allPrices.push(price);
                }
                const qty = inv?.seller?.quantity ?? 0;
                const stock = inv?.seller?.isStock ?? true;
                if (stock && qty > 0) {
                    hasInStock = true;
                }
            }
        }
    }
    const minPrice = prodObj.minPrice || (allPrices.length > 0 ? Math.min(...allPrices) : 0);
    const maxPrice = prodObj.maxPrice || (allPrices.length > 0 ? Math.max(...allPrices) : minPrice);
    const inStock = prodObj.inStock !== undefined ? prodObj.inStock : (allPrices.length > 0 ? hasInStock : true);

    return {
        ...prodObj,
        variants: variantsWithInventory,
        minPrice,
        maxPrice,
        price: minPrice,
        inStock,
        averageRating: prodObj.averageRating || 0,
        reviewCount: prodObj.reviewCount || 0,
    };
};


const allProductsFromDB = async (query: Record<string, unknown>) => {
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

    if (!products || products.length === 0) {
        return {
            meta,
            data: [],
        };
    }

    const productIds = products.map((p: any) => p._id);
    const referencedVariantIds: any[] = [];
    products.forEach((p) => {
        if (Array.isArray(p.variants)) {
            p.variants.forEach((vRef: any) => {
                const id = vRef?._id || vRef;
                if (id) referencedVariantIds.push(id);
            });
        }
    });

    const variants = await Variant.find({
        $or: [
            { product: { $in: productIds } },
            { _id: { $in: referencedVariantIds } },
        ],
        isDeleted: { $ne: true },
    }).lean();

    const variantIds = variants.map((v) => v._id);

    const inventories = await Inventory.find({
        variant: { $in: variantIds },
        isDeleted: { $ne: true },
    })
        .populate("seller.vendor", "name email role")
        .lean();

    const inventoriesByVariantId = new Map<string, any[]>();
    const seenInventoryIds = new Set<string>();
    for (const inv of inventories) {
        const invIdStr = inv._id.toString();
        if (seenInventoryIds.has(invIdStr)) continue;
        seenInventoryIds.add(invIdStr);

        const vId = inv.variant?.toString();
        if (vId) {
            if (!inventoriesByVariantId.has(vId)) {
                inventoriesByVariantId.set(vId, []);
            }
            inventoriesByVariantId.get(vId)!.push(inv);
        }
    }

    const variantsWithInventory = variants.map((variant) => {
        const vIdStr = variant._id.toString();
        const variantInventories = inventoriesByVariantId.get(vIdStr) || [];
        return {
            ...variant,
            inventory: variantInventories,
        };
    });

    const variantsByProductId = new Map<string, any[]>();
    for (const variant of variantsWithInventory) {
        const pIdStr = variant.product?.toString();
        if (pIdStr) {
            if (!variantsByProductId.has(pIdStr)) {
                variantsByProductId.set(pIdStr, []);
            }
            variantsByProductId.get(pIdStr)!.push(variant);
        }
    }

    const variantById = new Map<string, any>();
    for (const variant of variantsWithInventory) {
        variantById.set(variant._id.toString(), variant);
    }

    const data = products.map((prod: any) => {
        const prodObj = prod?.toObject ? prod.toObject() : prod;
        const pIdStr = prodObj._id.toString();

        const variantsMap = new Map<string, any>();

        const byProduct = variantsByProductId.get(pIdStr) || [];
        for (const v of byProduct) {
            variantsMap.set(v._id.toString(), v);
        }

        if (Array.isArray(prodObj.variants)) {
            for (const vRef of prodObj.variants) {
                const vId = (vRef?._id || vRef)?.toString();
                if (vId && variantById.has(vId)) {
                    variantsMap.set(vId, variantById.get(vId));
                }
            }
        }

        const productVariants = Array.from(variantsMap.values());
        const allPrices: number[] = [];
        let hasInStock = false;
        for (const v of productVariants) {
            if (Array.isArray(v.inventory)) {
                for (const inv of v.inventory) {
                    const price = inv?.seller?.price;
                    if (typeof price === "number" && price > 0) {
                        allPrices.push(price);
                    }
                    const qty = inv?.seller?.quantity ?? 0;
                    const stock = inv?.seller?.isStock ?? true;
                    if (stock && qty > 0) {
                        hasInStock = true;
                    }
                }
            }
        }
        const minPrice = prodObj.minPrice || (allPrices.length > 0 ? Math.min(...allPrices) : 0);
        const maxPrice = prodObj.maxPrice || (allPrices.length > 0 ? Math.max(...allPrices) : minPrice);
        const inStock = prodObj.inStock !== undefined ? prodObj.inStock : (allPrices.length > 0 ? hasInStock : true);

        return {
            ...prodObj,
            variants: productVariants,
            minPrice,
            maxPrice,
            price: minPrice,
            inStock,
            averageRating: prodObj.averageRating || 0,
            reviewCount: prodObj.reviewCount || 0,
        };
    });

    return {
        meta,
        data,
    };
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

    const result = await Product.findByIdAndUpdate(isProductExists._id, payload, {
        new: true,
        runValidators: true,
    });

    return result;
};

const productsByVendorFromDB = async (
    identifier: string,
    query: Record<string, unknown>
) => {
    if (!identifier || typeof identifier !== "string" || !identifier.trim()) {
        throw new AppError(httpStatus.BAD_REQUEST, "Vendor ID or email is required");
    }

    const trimmedIdentifier = identifier.trim();

    // 1. Identify the vendor by email, User ID, or Vendor ID
    let userDoc: any = null;
    let vendorDoc: any = null;

    if (trimmedIdentifier.includes("@")) {
        userDoc = await User.findOne({
            email: trimmedIdentifier,
            isDeleted: { $ne: true },
        }).lean();
        vendorDoc = await Vendor.findOne({
            email: trimmedIdentifier,
            isDeleted: { $ne: true },
        }).lean();
    } else if (mongoose.Types.ObjectId.isValid(trimmedIdentifier)) {
        const objId = new mongoose.Types.ObjectId(trimmedIdentifier);
        userDoc = await User.findOne({
            _id: objId,
            isDeleted: { $ne: true },
        }).lean();
        vendorDoc = await Vendor.findOne({
            _id: objId,
            isDeleted: { $ne: true },
        }).lean();
    } else {
        // Fallback search by vendor name
        vendorDoc = await Vendor.findOne({
            name: trimmedIdentifier,
            isDeleted: { $ne: true },
        }).lean();
        userDoc = await User.findOne({
            name: trimmedIdentifier,
            role: USER_ROLE.VENDOR,
            isDeleted: { $ne: true },
        }).lean();
    }

    // Cross-reference user and vendor records
    if (userDoc && !vendorDoc) {
        vendorDoc = await Vendor.findOne({
            user: userDoc._id,
            isDeleted: { $ne: true },
        }).lean();
    }

    if (vendorDoc && !userDoc) {
        userDoc = await User.findOne({
            _id: vendorDoc.user,
            isDeleted: { $ne: true },
        }).lean();
    }

    if (!userDoc && !vendorDoc) {
        throw new AppError(httpStatus.NOT_FOUND, "Vendor not found");
    }

    // Collect all identifiers representing this vendor in inventory
    const candidateVendorIds: any[] = [];
    if (userDoc?._id) candidateVendorIds.push(userDoc._id);
    if (vendorDoc?._id) candidateVendorIds.push(vendorDoc._id);
    if (vendorDoc?.user) candidateVendorIds.push(vendorDoc.user);

    // 2. Fetch inventory records strictly belonging to this vendor
    const vendorInventories = await Inventory.find({
        "seller.vendor": { $in: candidateVendorIds },
        isDeleted: { $ne: true },
    })
        .populate("seller.vendor", "name email role")
        .lean();

    if (!vendorInventories || vendorInventories.length === 0) {
        return {
            meta: {
                page: Number(query?.page) || 1,
                limit: Number(query?.limit) || 10,
                total: 0,
                totalPage: 0,
            },
            data: [],
        };
    }

    // Group vendor inventory items by variant ID
    const inventoriesByVariantId = new Map<string, any[]>();
    const variantIdSet = new Set<string>();

    for (const inv of vendorInventories) {
        const vId = inv.variant?.toString();
        if (vId) {
            variantIdSet.add(vId);
            if (!inventoriesByVariantId.has(vId)) {
                inventoriesByVariantId.set(vId, []);
            }
            inventoriesByVariantId.get(vId)!.push(inv);
        }
    }

    const targetVariantIds = Array.from(variantIdSet).map(
        (id) => new mongoose.Types.ObjectId(id)
    );

    // 3. Fetch variants that this vendor sells
    const variants = await Variant.find({
        _id: { $in: targetVariantIds },
        isDeleted: { $ne: true },
    }).lean();

    const variantsByProductId = new Map<string, any[]>();
    const productIdSet = new Set<string>();

    for (const variant of variants) {
        const vIdStr = variant._id.toString();
        const vendorInvs = inventoriesByVariantId.get(vIdStr) || [];
        if (vendorInvs.length === 0) continue;

        const primaryInv = vendorInvs[0];
        const vendorPrice = primaryInv?.seller?.price ?? 0;

        const variantWithVendorData = {
            ...variant,
            price: vendorPrice,
            seller: primaryInv?.seller,
            inventory: vendorInvs,
        };

        const pIdStr = variant.product?.toString();
        if (pIdStr) {
            productIdSet.add(pIdStr);
            if (!variantsByProductId.has(pIdStr)) {
                variantsByProductId.set(pIdStr, []);
            }
            variantsByProductId.get(pIdStr)!.push(variantWithVendorData);
        }
    }

    const matchingProductIds = Array.from(productIdSet).map(
        (id) => new mongoose.Types.ObjectId(id)
    );

    // 4. Query products using QueryBuilder
    const productQueryObj = {
        $or: [
            { _id: { $in: matchingProductIds } },
            { variants: { $in: targetVariantIds } },
        ],
        isDeleted: { $ne: true },
    };

    const productsQuery = new QueryBuilder(
        Product.find(productQueryObj)
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

    // 5. Build vendor-specific products response
    const variantById = new Map<string, any>();
    for (const variant of variants) {
        const vIdStr = variant._id.toString();
        const vendorInvs = inventoriesByVariantId.get(vIdStr) || [];
        if (vendorInvs.length > 0) {
            const primaryInv = vendorInvs[0];
            variantById.set(vIdStr, {
                ...variant,
                price: primaryInv?.seller?.price ?? 0,
                seller: primaryInv?.seller,
                inventory: vendorInvs,
            });
        }
    }

    const data = products
        .map((prod: any) => {
            const prodObj = prod?.toObject ? prod.toObject() : prod;
            const pIdStr = prodObj._id.toString();

            const variantsMap = new Map<string, any>();

            // Variants matched by variant.product
            const byProduct = variantsByProductId.get(pIdStr) || [];
            for (const v of byProduct) {
                variantsMap.set(v._id.toString(), v);
            }

            // Variants matched by product.variants reference
            if (Array.isArray(prodObj.variants)) {
                for (const vRef of prodObj.variants) {
                    const vId = (vRef?._id || vRef)?.toString();
                    if (vId && variantById.has(vId)) {
                        variantsMap.set(vId, variantById.get(vId));
                    }
                }
            }

            const vendorSpecificVariants = Array.from(variantsMap.values());

            const prices = vendorSpecificVariants
                .map((v) => v.price)
                .filter((p: number) => typeof p === "number" && p > 0);

            const minPrice = prices.length > 0 ? Math.min(...prices) : undefined;
            const maxPrice = prices.length > 0 ? Math.max(...prices) : undefined;

            return {
                ...prodObj,
                variants: vendorSpecificVariants,
                price: minPrice,
                minPrice,
                maxPrice,
            };
        })
        .filter((prod: any) => prod.variants && prod.variants.length > 0);

    return {
        meta,
        data,
    };
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

    // Fetch only pricing and buy box winner status from inventory (no vendor/inventory metadata)
    const inventoryListings = await Inventory.find({
        $or: [
            { variant: { $in: variantIds } },
            { asin: { $in: variantAsins } },
        ],
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

export const ProductServices = {
    createProductIntoDB,
    allProductsFromDB,
    productFromDB,
    updateProductIntoDB,
    productsByVendorFromDB,
};

