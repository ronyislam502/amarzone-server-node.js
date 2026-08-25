import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { DepartmentServices } from "./department.service";
import { TImageFile } from "../../interface/image.interface";

const createDepartment = catchAsync(async (req, res) => {
    const result = await DepartmentServices.createDepartmentIntoDB(req.file as TImageFile, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Department created successfully",
        data: result
    })
})

const allDepartments = catchAsync(async (req, res) => {
    const result = await DepartmentServices.allDepartmentsFromDB(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Departments retrieved successfully",
        data: result
    })
})

const updateDepartment = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await DepartmentServices.updateDepartmentIntoDB(id, req.file as TImageFile, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Department updated successfully",
        data: result
    })
})

export const DepartmentControllers = {
    createDepartment,
    updateDepartment,
    allDepartments
}