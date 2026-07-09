import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { UserServices } from "./user.service";
import { TImageFile } from "../../interface/image.interface";

const createAdmin = catchAsync(async (req, res) => {
  const { password, admin } = req.body;
  const result = await UserServices.createAdminIntoDB(
    req.file as TImageFile,
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

const createVendor = catchAsync(async (req, res) => {
  const { password, vendor } = req.body;
  const result = await UserServices.createVendorIntoDB(password, vendor);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendor Created successfully",
    data: result,
  });
});

const createCustomer = catchAsync(async (req, res) => {
  const { password, customer } = req.body;
  const result = await UserServices.createCustomerIntoDB(password, customer);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Customer Created successfully",
    data: result,
  });
});





export const UserControllers = {
  createAdmin,
  createVendor,
  createCustomer,
};
