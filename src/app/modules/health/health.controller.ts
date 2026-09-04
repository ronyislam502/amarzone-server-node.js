import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { AccountHealthServices } from "./health.service";
import { User } from "../user/user.model";
import AppError from "../../errors/AppError";

const getMyHealth = catchAsync(async (req, res) => {
    const userEmail = req.user.email;
    const isUserExists = await User.findOne({ email: userEmail });
    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const result = await AccountHealthServices.getVendorHealthFromDB(
        isUserExists._id.toString()
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Vendor account health retrieved successfully",
        data: result,
    });
});

const getVendorHealth = catchAsync(async (req, res) => {
    const { vendorId } = req.params;
    const result = await AccountHealthServices.getVendorHealthFromDB(vendorId);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Vendor account health retrieved successfully by Admin",
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
    getVendorHealth,
    recalculateVendorHealth,
};
