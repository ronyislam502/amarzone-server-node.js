import httpStatus from "http-status";
import sendResponse from "../../utilities/sendResponse";
import { ServiceReviewServices } from "./serviceReview.service";
import catchAsync from "./../../utilities/catchAsync";

const createServiceReview = catchAsync(async (req, res) => {
  const result = await ServiceReviewServices.createServiceReviewIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service Review created successfully",
    data: result,
  });
});

const allServiceReviewsByVendor = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ServiceReviewServices.allServiceReviewsByVendorFromDB(
    id,
    req.query
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Service reviews by vendor retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const ServiceReviewControllers = {
  createServiceReview,
  allServiceReviewsByVendor,
};
