import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { DisputeDecisionServices } from "./disputeDecision.service";
import { User } from "../user/user.model";
import AppError from "../../errors/AppError";

const getUserIdFromUserPayload = async (email: string) => {
  const user = await User.findOne({ email, isDeleted: false });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "Authenticated user not found");
  }
  return user._id;
};

const createDecision = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const result = await DisputeDecisionServices.createDecision(
    currentUserId,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Dispute decision recorded successfully",
    data: result,
  });
});

const getDecisionByDisputeId = catchAsync(async (req, res) => {
  const currentUserId = await getUserIdFromUserPayload(req.user.email);
  const { disputeId } = req.params;
  const result = await DisputeDecisionServices.getDecisionByDisputeId(
    currentUserId,
    req.user.role,
    disputeId
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dispute decision retrieved successfully",
    data: result,
  });
});

export const DisputeDecisionControllers = {
  createDecision,
  getDecisionByDisputeId,
};
