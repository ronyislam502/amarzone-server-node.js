import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { ProductServices } from "./product.service";
import { TImageFiles } from "../../interface/image.interface";

const createProduct = catchAsync(async (req, res) => {
    const result = await ProductServices.createProductIntoDB(req.user, req.files as TImageFiles, req.body)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "product created successfully",
        data: result
    })
})


const updateProduct = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await ProductServices.updateProductIntoDB(req.user, id, req.files as TImageFiles, req.body)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "product created successfully",
        data: result
    })
})

const myCreatedProducts = catchAsync(async (req, res) => {
    const result = await ProductServices.myCreatedProductsFromDB(req.user, req.query)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "my created products retrieved successfully",
        data: result
    })
})


export const ProductControllers = {
    createProduct,
    updateProduct,
    myCreatedProducts
}