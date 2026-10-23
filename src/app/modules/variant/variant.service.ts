import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Product } from "../product/product.model";
import { TVariant } from "./variant.interface";
import { TImageFiles } from "../../interface/image.interface";
import { Variant } from "./variant.model";
import { generateSKU } from "../../utilities/generateSku";
import { generateASIN } from "../../utilities/generateAsin";
import QueryBuilder from "../../builder/queryBuilder";
import { Vendor } from "../vendor/vendor.model";
import { Inventory } from "../inventory/inventory.model";
import { USER_ROLE } from "../../interface/common";
import { User } from "../user/user.model";


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




export const VariantServices = {
    createVariantIntoDB,
    allVariantsByProductFromDB,
};