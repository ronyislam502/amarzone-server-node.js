import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { ReviewServices } from "./review.service";

const createProductReview = catchAsync(async (req, res) => {
  const result = await ReviewServices.createProductReviewIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product review created successfully",
    data: result,
  });
});

const singleProductReviews = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ReviewServices.singleProductReviewsFromDB(id, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product reviews retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const createShopReview = catchAsync(async (req, res) => {
  const { email } = req.params;
  const result = await ReviewServices.createShopReviewIntoDB(email, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shop review created successfully",
    data: result,
  });
});

const singleShopReviews = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ReviewServices.singleShopReviewsFromDB(id, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shop reviews retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const ReviewControllers = {
  createProductReview,
  singleProductReviews,
  createShopReview,
  singleShopReviews,
};
