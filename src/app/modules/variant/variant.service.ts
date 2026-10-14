import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Product } from "../product/product.model";
import { TVariant } from "./variant.interface";
import { TImageFiles } from "../../interface/image.interface";
import { Variant } from "./variant.model";
import { generateSKU } from "../../utilities/generateSku";
import { generateASIN } from "../../utilities/generateAsin";
import QueryBuilder from "../../builder/queryBuilder";
import { Department } from "../department/department.model";


const createVariantIntoDB = async (images: TImageFiles, payload: TVariant) => {

    const isProductExists = await Product.findById(payload?.product).populate("department").populate("category");

    if (!isProductExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this product not found");
    }

    if (isProductExists.variants && isProductExists.variants.length > 0) {
        for (const variantId of isProductExists.variants) {
            const existingVariant = await Variant.findById(variantId);
            if (existingVariant) {
                // Check for duplicate attributes
                const attributeMatches = existingVariant.attributes.every(attr =>
                    payload.attributes.some(
                        (pAttr: any) => pAttr.type === attr.type && pAttr.value === attr.value
                    )
                );

                if (attributeMatches) {
                    throw new AppError(httpStatus.BAD_REQUEST, "Variant with same attributes already exists for this product");
                }
            }
        }
    }


    if (images && images.images) {
        payload.images = images.images.map((img) => img.path);
    }

    const department = isProductExists?.department;

    if (!department) {
        throw new AppError(httpStatus.NOT_FOUND, "this product department not found");
    }
    const category = isProductExists?.category;

    if (!category) {
        throw new AppError(httpStatus.NOT_FOUND, "this product category not found");
    }

    payload.asin = await generateASIN((department as any).name, (category as any).name);

    payload.sku = generateSKU(payload.asin, payload.attributes);

    const result = await Variant.create(payload)

    return result;
};

const allVariantsByProductFromDB = async (id: string, query: Record<string, unknown>) => {
    const isProductExists = await Product.findById(id);
    if (!isProductExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this product not found");
    }
    const variantProductQuery = new QueryBuilder(Variant.find({ product: isProductExists._id }).populate("product"), query)
        .search([""])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await variantProductQuery.countTotal();
    const data = await variantProductQuery.modelQuery;

    return { meta, data }
}



const allVariantsProductsByDepartmentFromDB = async (id: string, query: Record<string, unknown>) => {
    // 1. Prothome department check kora
    const isDepartment = await Department.findById(id);
    if (!isDepartment) {
        throw new AppError(httpStatus.NOT_FOUND, "Department not found");
    }

    // 2. Oi department-er under-e sob product-er ID gulo ber kore newa
    const productsInDepartment = await Product.find({ department: isDepartment._id, isDeleted: false }).select('_id');
    const productIds = productsInDepartment.map(product => product._id);

    // 3. Ekhon sei product IDs gulo diye Variant model-e QueryBuilder chalano
    const variantProductQuery = new QueryBuilder(
        Variant.find({ product: { $in: productIds } }).populate({
            path: "product",
            match: { isDeleted: false } // Safety-r jonno product delete na thakle populate hobe
        }),
        query
    )
        .search(["sku", "asin"]) // Apnar proyojon moto search fields add korben
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await variantProductQuery.countTotal();
    const data = await variantProductQuery.modelQuery;

    return {
        meta,
        data
    };
};

export default allVariantsProductsByDepartmentFromDB;

export const VariantServices = {
    createVariantIntoDB,
    allVariantsByProductFromDB,
    allVariantsProductsByDepartmentFromDB
};