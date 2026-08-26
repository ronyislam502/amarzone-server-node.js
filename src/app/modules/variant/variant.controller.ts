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

export const VariantControllers = {
    createVariant,
};
