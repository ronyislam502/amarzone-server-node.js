import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { SlaViolationServices } from "./violation.service";
import { User } from "../user/user.model";
import AppError from "../../errors/AppError";

const getMyViolations = catchAsync(async (req, res) => {
  const userEmail = req.user.email;
  const isUserExists = await User.findOne({ email: userEmail });
  if (!isUserExists) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const result = await SlaViolationServices.getVendorViolationsFromDB(
    isUserExists._id.toString()
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendor SLA violations retrieved successfully",
    data: result,
  });
});

const getVendorViolations = catchAsync(async (req, res) => {
  const { vendorId } = req.params;
  const result = await SlaViolationServices.getVendorViolationsFromDB(vendorId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendor SLA violations retrieved successfully by Admin",
    data: result,
  });
});

const getAllViolations = catchAsync(async (req, res) => {
  const result = await SlaViolationServices.getAllViolationsFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "All SLA violations retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const SlaViolationControllers = {
  getMyViolations,
  getVendorViolations,
  getAllViolations,
};
