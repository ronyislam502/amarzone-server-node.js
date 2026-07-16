import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { DisputeServices } from "./dispute.service";
import { User } from "../user/user.model";
import AppError from "../../errors/AppError";

const getUserIdFromUserPayload = async (email: string) => {
  const user = await User.findOne({ email, isDeleted: false });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "Authenticated user not found");
  }
  return user._id;
};

const createDispute = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const result = await DisputeServices.createDispute(currentUserId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Dispute raised successfully",
    data: result,
  });
});

const getDisputeById = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const { id } = req.params;
  const result = await DisputeServices.getDisputeById(
    currentUserId,
    req.user.role,
    id
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dispute retrieved successfully",
    data: result,
  });
});

const getUserDisputes = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const result = await DisputeServices.getUserDisputes(
    currentUserId,
    req.user.role,
    req.query
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Disputes retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const updateDisputeStatus = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const { id } = req.params;
  const result = await DisputeServices.updateDisputeStatus(
    currentUserId,
    id,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dispute status updated successfully",
    data: result,
  });
});

export const DisputeControllers = {
  createDispute,
  getDisputeById,
  getUserDisputes,
  updateDisputeStatus,
};
