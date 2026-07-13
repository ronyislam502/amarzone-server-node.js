import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { ReviewServices } from "./review.service";

const createReview = catchAsync(async (req, res) => {
  const result = await ReviewServices.createReviewIntoDB(req.user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service review created successfully",
    data: result,
  });
});

const updateReview = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ReviewServices.updateReviewInDB(req.user, id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service review updated successfully",
    data: result,
  });
});

const deleteReview = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ReviewServices.deleteReviewFromDB(req.user, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service review deleted successfully",
    data: result,
  });
});

const getSingleReview = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ReviewServices.getSingleReviewFromDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service review retrieved successfully",
    data: result,
  });
});

const getAllReviews = catchAsync(async (req, res) => {
  const result = await ReviewServices.getAllReviewsFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service reviews retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getReviewsByVendor = catchAsync(async (req, res) => {
  const { vendorId } = req.params;
  const result = await ReviewServices.allReviewsByVendorFromDB(vendorId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Vendor service reviews retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const getMyReviews = catchAsync(async (req, res) => {
  const result = await ReviewServices.getMyReviewsFromDB(req.user, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My service reviews retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});
export const ReviewControllers = {
  createReview,
  updateReview,
  deleteReview,
  getSingleReview,
  getAllReviews,
  getReviewsByVendor,
  getMyReviews,
};
