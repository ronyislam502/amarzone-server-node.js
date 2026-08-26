import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Product } from "../product/product.model";
import { TVariants } from "./variant.interface";
import { TImageFiles } from "../../interface/image.interface";

const createVariantIntoDB = async (images: TImageFiles, payload: TVariants) => {
    const isProductExists = await Product.findById(payload.product);

    if (!isProductExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this product not found");
    }


}

export const VariantServices = {
    createVariantIntoDB
}