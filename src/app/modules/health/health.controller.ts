import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { AccountHealthServices } from "./health.service";
import { User } from "../user/user.model";
import AppError from "../../errors/AppError";
import { JwtPayload } from "jsonwebtoken";

const getMyHealth = catchAsync(async (req, res) => {
    const result = await AccountHealthServices.getVendorHealthFromDB(
        req.user as JwtPayload
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Vendor account health retrieved successfully",
        data: result,
    });
});


const recalculateVendorHealth = catchAsync(async (req, res) => {
    const { vendorId } = req.params;
    const result = await AccountHealthServices.calculateVendorHealth(vendorId);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Vendor account health recalculated successfully",
        data: result,
    });
});

export const AccountHealthControllers = {
    getMyHealth,
    recalculateVendorHealth,
};
