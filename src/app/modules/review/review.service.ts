import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
import AppError from "../../errors/AppError";
import { ORDER_STATUS } from "../../interface/common";
import { Order } from "../order/order.model";
import { User } from "../user/user.model";
import { TServiceReview } from "./review.interface";
import QueryBuilder from "../../builder/queryBuilder";
import { ServiceReview } from "./review.model";
import { AccountHealthServices } from "../health/health.service";



const createReviewIntoDB = async (user: JwtPayload, payload: Partial<TServiceReview>) => {
  const customer = await User.isUserExistsByEmail(user.email);
  if (!customer) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
  }

  const { order, rating, title, review } = payload;
  if (!order) {
    throw new AppError(httpStatus.BAD_REQUEST, "Order ID is required");
  }

  // Fetch the order
  const orderData = await Order.findById(order);
  if (!orderData) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  // Verify the customer owns the order
  if (orderData.customer.toString() !== customer._id?.toString()) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not authorized to review this order");
  }

  // Verify the order is completed (COMPLETE or DELIVERED status)
  const isCompleted =
    orderData.status === ORDER_STATUS.COMPLETE ||
    orderData.status === ORDER_STATUS.DELIVERED;

  if (!isCompleted) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You can only review vendors for completed or delivered orders"
    );
  }

  // Prevent duplicate reviews for the same order
  const existingReview = await ServiceReview.findOne({ order, isDeleted: false });
  if (existingReview) {
    throw new AppError(httpStatus.BAD_REQUEST, "A service review for this order already exists");
  }

  const reviewResult = await ServiceReview.create({
    customer: customer._id,
    vendor: orderData.vendor,
    order: orderData._id,
    rating,
    title,
    review,
  });

  if (reviewResult.vendor) {
    try {
      await AccountHealthServices.calculateVendorHealth(reviewResult.vendor.toString());
    } catch (error) {
      console.error("[Review Service Create] Failed to recalculate vendor health:", error);
    }
  }

  return reviewResult;
};

const updateReviewInDB = async (
  user: JwtPayload,
  id: string,
  payload: Partial<TServiceReview>
) => {
  const customer = await User.isUserExistsByEmail(user.email);
  if (!customer) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
  }

  const reviewData = await ServiceReview.findOne({ _id: id, isDeleted: false });
  if (!reviewData) {
    throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  }

  // Only the review owner can update
  if (reviewData.customer.toString() !== customer._id?.toString()) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not authorized to update this review");
  }

  const result = await ServiceReview.findByIdAndUpdate(
    id,
    {
      $set: {
        ...(payload.rating !== undefined && { rating: payload.rating }),
        ...(payload.title !== undefined && { title: payload.title }),
        ...(payload.review !== undefined && { review: payload.review }),
      },
    },
    { new: true, runValidators: true }
  );

  if (result && result.vendor) {
    try {
      await AccountHealthServices.calculateVendorHealth(result.vendor.toString());
    } catch (error) {
      console.error("[Review Service Update] Failed to recalculate vendor health:", error);
    }
  }

  return result;
};

const deleteReviewFromDB = async (user: JwtPayload, id: string) => {
  const currentUser = await User.isUserExistsByEmail(user.email);
  if (!currentUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const reviewData = await ServiceReview.findOne({ _id: id, isDeleted: false });
  if (!reviewData) {
    throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  }

  // Customers can only delete their own reviews; Admins/Super Admins can delete any
  const isOwner = reviewData.customer.toString() === currentUser._id?.toString();
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  if (!isOwner && !isAdmin) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not authorized to delete this review");
  }

  const result = await ServiceReview.findByIdAndUpdate(
    id,
    { $set: { isDeleted: true } },
    { new: true }
  );

  if (result && result.vendor) {
    try {
      await AccountHealthServices.calculateVendorHealth(result.vendor.toString());
    } catch (error) {
      console.error("[Review Service Delete] Failed to recalculate vendor health:", error);
    }
  }

  return result;
};

const getSingleReviewFromDB = async (id: string) => {
  const result = await ServiceReview.findOne({ _id: id, isDeleted: false })
    .populate("customer")
    .populate("vendor")
    .populate("order");

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  }

  return result;
};

const getAllReviewsFromDB = async (query: Record<string, unknown>) => {
  const reviewQuery = new QueryBuilder(
    ServiceReview.find().populate("customer").populate("vendor").populate("order"),
    query
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await reviewQuery.countTotal();
  const data = await reviewQuery.modelQuery;

  return { meta, data };
};

const allReviewsByVendorFromDB = async (vendorId: string, query: Record<string, unknown>) => {
  const reviewQuery = new QueryBuilder(
    ServiceReview.find({ vendor: vendorId }).populate("customer").populate("order"),
    query
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await reviewQuery.countTotal();
  const data = await reviewQuery.modelQuery;

  const totalRatings = data?.reduce((sum, review) => sum + review.rating, 0);
  const averageRating =
    data.length > 0 ? (totalRatings / data.length).toFixed(2) : "0.00";

  return { meta, data, averageRating };
};

const getMyReviewsFromDB = async (user: JwtPayload, query: Record<string, unknown>) => {
  const customer = await User.isUserExistsByEmail(user.email);
  if (!customer) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
  }

  const reviewQuery = new QueryBuilder(
    ServiceReview.find({ customer: customer._id }).populate("vendor").populate("order"),
    query
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await reviewQuery.countTotal();
  const data = await reviewQuery.modelQuery;

  return { meta, data };
};


export const ReviewServices = {
  createReviewIntoDB,
  updateReviewInDB,
  deleteReviewFromDB,
  getSingleReviewFromDB,
  getAllReviewsFromDB,
  allReviewsByVendorFromDB,
  getMyReviewsFromDB,
};
