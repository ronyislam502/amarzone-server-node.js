import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { VariantServices } from "./variant.service";
import { TImageFiles } from "../../interface/image.interface";

const createVariant = catchAsync(async (req, res) => {
    const result = await VariantServices.createVariantIntoDB(
        req.files as TImageFiles,
        req.body
    );

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "Variant created successfully",
        data: result,
    });
});

const allVariantsByProduct = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await VariantServices.allVariantsByProductFromDB(id,
        req.query
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Variants by product retrieved successfully",
        data: result,
    });
});

export const VariantControllers = {
    createVariant,
    allVariantsByProduct
};
