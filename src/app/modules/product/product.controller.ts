import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { ProductServices } from "./product.service";
import { JwtPayload } from "jsonwebtoken";
import { TImageFile } from "../../interface/image.interface";

const createProduct = catchAsync(async (req, res) => {
    const result = await ProductServices.createProductIntoDB(req.user as JwtPayload, req.file as TImageFile, req.body);

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "Product created successfully",
        data: result,
    });
});

const allProducts = catchAsync(async (req, res) => {
    const result = await ProductServices.allProductsFromDB(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Products retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const singleProduct = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await ProductServices.productFromDB(id);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Product retrieved successfully",
        data: result,
    });
});

const updateProduct = catchAsync(async (req, res) => {
    const result = await ProductServices.updateProductIntoDB(req.user as JwtPayload, req.params.id, req.file as TImageFile, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Product updated successfully",
        data: result,
    });
});

export const ProductControllers = {
    createProduct,
    allProducts,
    singleProduct,
    updateProduct,
};
