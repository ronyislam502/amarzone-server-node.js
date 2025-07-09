import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { DepartmentServices } from "./department.service";

const createDepartment = catchAsync(async (req, res) => {
  const result = await DepartmentServices.createDepartmentIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Department created successfully",
    data: result,
  });
});

const allDepartments = catchAsync(async (req, res) => {
  const result = await DepartmentServices.allDepartmentsFromDB();

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Departments retrieved successfully",
    data: result,
  });
});

const updateDepartments = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await DepartmentServices.updateDepartmentIntoDB(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Department updated successfully",
    data: result,
  });
});

export const DepartmentControllers = {
  createDepartment,
  allDepartments,
  updateDepartments,
};
