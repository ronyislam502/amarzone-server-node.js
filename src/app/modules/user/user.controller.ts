import httpStatus from "http-status";
import { TImageFile } from "../../interface/image.interface";
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
})


export const UserControllers = {
    createAdmin
}