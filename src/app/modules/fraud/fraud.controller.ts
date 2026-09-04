import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { FraudServices } from "./fraud.service";

const getAllFraudAlerts = catchAsync(async (req: Request, res: Response) => {
  const result = await FraudServices.getAllFraudAlertsFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Fraud alerts retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getFraudAlertsByUser = catchAsync(async (req: Request, res: Response) => {
  const { userId } = req.params;
  const result = await FraudServices.getFraudAlertsByUserIdFromDB(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User fraud alerts retrieved successfully",
    data: result,
  });
});

const updateFraudStatus = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const adminId = req.user._id;
  const result = await FraudServices.updateFraudStatusInDB(id, adminId, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Fraud status updated successfully",
    data: result,
  });
});

const evaluateFraudRisk = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId || req.body.userId || req.user._id;
  const result = await FraudServices.evaluateUserFraudRisk(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Fraud risk evaluated successfully",
    data: result,
  });
});

export const FraudControllers = {
  getAllFraudAlerts,
  getFraudAlertsByUser,
  updateFraudStatus,
  evaluateFraudRisk,
};
