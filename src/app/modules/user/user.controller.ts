import httpStatus from "http-status";
import { TImageFile, TImageFiles } from "../../interface/image.interface";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { UserServices } from "./user.service";

const createAdmin = catchAsync(async (req, res) => {
    const { password, admin } = req.body;
    const result = await UserServices.createAdminIntoDB(req.file as TImageFile, password, admin);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Admin created successfully",
        data: result
    })
});

const createVendor = catchAsync(async (req, res) => {
    const { password, vendor } = req.body;
    const result = await UserServices.createVendorIntoDB(req.files as TImageFiles, password, vendor);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Vendor created successfully",
        data: result
    })
})


export const UserControllers = {
    createAdmin,
    createVendor
}