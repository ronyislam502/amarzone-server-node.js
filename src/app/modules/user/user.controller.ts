import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { UserServices } from "./user.service";
import { TImageFile, TImageFiles } from "../../interface/image.interface";

const createAdmin = catchAsync(async (req, res) => {
  const { password, admin } = req.body;
  const result = await UserServices.createAdminIntoDB(
    req.files as TImageFiles,
    password,
    admin
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Admin Created successfully",
    data: result,
  });
});

const createStaff = catchAsync(async (req, res) => {
  const { password, admin } = req.body;
  const result = await UserServices.createStaffIntoDB(
    req.files as TImageFiles,
    password,
    admin
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Staff Created successfully",
    data: result,
  });
});

const getAllUsers = catchAsync(async (req, res) => {
  const users = await UserServices.getAllUsersFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Users retrieved successfully",
    meta: users.meta,
    data: users.data,
  });
});

export const UserControllers = {
  createAdmin,
  getAllUsers,
  createStaff,
};
