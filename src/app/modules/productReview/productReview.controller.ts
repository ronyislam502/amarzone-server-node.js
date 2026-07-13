import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { ProductReviewServices } from "./productReview.service";

const createProductReview = catchAsync(async (req, res) => {
  const result = await ProductReviewServices.createProductReviewIntoDB(req.user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product review created successfully",
    data: result,
  });
});

const updateProductReview = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ProductReviewServices.updateProductReviewInDB(req.user, id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product review updated successfully",
    data: result,
  });
});

const deleteProductReview = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ProductReviewServices.deleteProductReviewFromDB(req.user, id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product review deleted successfully",
    data: result,
  });
});

const getSingleProductReview = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ProductReviewServices.allReviewsByProductFromDB(id, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product review retrieved successfully",
    data: result,
  });
});



export const ProductReviewControllers = {
  createProductReview,
  updateProductReview,
  deleteProductReview,
  getSingleProductReview,
}
