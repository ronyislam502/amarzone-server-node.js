import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { AdminServices } from "./admin.service";
import { TImageFile } from "../../interface/image.interface";

const allAdmins = catchAsync(async (req, res) => {
    const result = await AdminServices.allAdminsFromDB(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Admins retrieved successfully",
        meta: result.meta,
        data: result?.data
    })
})

const admin = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await AdminServices.adminFromDB(id);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Admin retrieved successfully",
        data: result
    })
})

const updateAdmin = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await AdminServices.updateAdminIntoDB(id, req.file as TImageFile, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Admin updated successfully",
        data: result
    })
})

const deleteAdmin = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await AdminServices.deleteAdminFromDB(id);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Admin deleted successfully",
        data: result
    })
})


export const AdminControllers = {
    allAdmins,
    admin,
    updateAdmin,
    deleteAdmin
}