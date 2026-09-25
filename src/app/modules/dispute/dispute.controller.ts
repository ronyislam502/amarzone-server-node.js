import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { DisputeServices } from "./dispute.service";
import { JwtPayload } from "jsonwebtoken";
import { userInfo } from "os";



const createDispute = catchAsync(async (req, res) => {
  const result = await DisputeServices.createDispute(req.user as JwtPayload, req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Dispute raised successfully",
    data: result,
  });
});

const getDisputeById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await DisputeServices.getDisputeById(
    req.user as JwtPayload,
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
  const result = await DisputeServices.getUserDisputesFromDB(
    req.user as JwtPayload,
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
  const { id } = req.params;
  const result = await DisputeServices.updateDisputeStatus(
    req.user as JwtPayload,
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
