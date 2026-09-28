
import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { AiServices } from "./ai.service";
import { TImageFiles } from "../../interface/image.interface";
import { TProductContentInput } from "./ai.interface";

const generateProductContent = catchAsync(async (req, res) => {
  const files = req.files as TImageFiles | undefined;
  const file =
    req.file ||
    files?.images?.[0] ||
    files?.image?.[0] ||
    (files as any)?.file?.[0];

  const payload: TProductContentInput = {
    ...req.body,
    ...(file?.path && !req.body.imageUrl ? { imageUrl: file.path } : {}),
  };

  const result = await AiServices.generateProductContent(payload);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product content generated successfully",
    data: result,
  });
});

const shoppingAssistant = catchAsync(async (req, res) => {
  const result = await AiServices.chatShoppingAssistant(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shopping assistant response generated successfully",
    data: result,
  });
});

const getDashboardInsights = catchAsync(async (req, res) => {
  const result = await AiServices.generateDashboardInsights(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Dashboard insights generated successfully",
    data: result,
  });
});

const moderateReview = catchAsync(async (req, res) => {
  const result = await AiServices.moderateReview(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Review moderation analysis completed",
    data: result,
  });
});

const analyzeFraudRisk = catchAsync(async (req, res) => {
  const result = await AiServices.analyzeFraudRisk(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Fraud risk analysis completed",
    data: result,
  });
});

export const AiControllers = {
  generateProductContent,
  shoppingAssistant,
  getDashboardInsights,
  moderateReview,
  analyzeFraudRisk,
};

export const aiControllers = AiControllers;
