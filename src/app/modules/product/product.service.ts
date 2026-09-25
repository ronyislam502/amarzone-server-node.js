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

    return {
        ...prodObj,
        variants: variantsWithInventory,
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

        return {
            ...prodObj,
            variants: Array.from(variantsMap.values()),
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

export const ProductServices = {
    createProductIntoDB,
    allProductsFromDB,
    productFromDB,
    updateProductIntoDB,
    productsByVendorFromDB,
};

