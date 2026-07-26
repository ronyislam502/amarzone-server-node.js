import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { ProductServices } from "./product.service";
import { TImageFiles } from "../../interface/image.interface";

const createProduct = catchAsync(async (req, res) => {
    const result = await ProductServices.createProductIntoDB(req.user, req.files as TImageFiles, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Product created successfully",
        data: result,
    });
});

const getSingleProduct = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await ProductServices.getSingleProductFromDB(id);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Product retrieved successfully",
        data: result,
    });
});

const updateProduct = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await ProductServices.updateProductIntoDB(req.user, id, req.files as TImageFiles, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Product updated successfully",
        data: result,
    });
});

const deleteProduct = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await ProductServices.deleteProductFromDB(req.user, id);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Product deleted successfully",
        data: result,
    });
});

const myCreatedProducts = catchAsync(async (req, res) => {
    const result = await ProductServices.myCreatedProductsFromDB(req.user, req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "My created products retrieved successfully",
        meta: result.meta,
        data: result.data,
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

export const ProductControllers = {
    createProduct,
    getSingleProduct,
    updateProduct,
    deleteProduct,
    myCreatedProducts,
    allProducts,
};