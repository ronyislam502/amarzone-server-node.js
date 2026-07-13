import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
import { Types } from "mongoose";
import AppError from "../../errors/AppError";
import { ORDER_STATUS } from "../../interface/common";
import { Order } from "../order/order.model";
import { User } from "../user/user.model";
import { TProductReview } from "./productReview.interface";
import { ProductReview } from "./productReview.model";
import QueryBuilder from "../../builder/queryBuilder";

const createProductReviewIntoDB = async (user: JwtPayload, payload: Partial<TProductReview>) => {
  const customer = await User.isUserExistsByEmail(user.email);
  if (!customer) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
  }

  const { product, order, rating, title, review } = payload;
  if (!product || !order) {
    throw new AppError(httpStatus.BAD_REQUEST, "Product ID and Order ID are required");
  }

  // Verify the customer purchased this product in a completed/delivered order
  const orderData = await Order.findOne({
    _id: order,
    customer: customer._id,
    status: { $in: [ORDER_STATUS.COMPLETE, ORDER_STATUS.DELIVERED] },
    "products.product": product,
  });

  if (!orderData) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You can only review products that you have purchased in a completed or delivered order"
    );
  }

  // Prevent duplicate reviews for the same product by the same customer
  const existingReview = await ProductReview.findOne({
    customer: customer._id,
    product,
    isDeleted: false,
  });

  if (existingReview) {
    throw new AppError(httpStatus.BAD_REQUEST, "You have already reviewed this product");
  }

  const result = await ProductReview.create({
    customer: customer._id,
    product,
    order,
    rating,
    title,
    review,
  });

  return result;
};

const updateProductReviewInDB = async (
  user: JwtPayload,
  id: string,
  payload: Partial<TProductReview>
) => {
  const customer = await User.isUserExistsByEmail(user.email);
  if (!customer) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
  }

  const reviewData = await ProductReview.findOne({ _id: id, isDeleted: false });
  if (!reviewData) {
    throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  }

  // Only the review owner can update
  if (reviewData.customer.toString() !== customer._id?.toString()) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not authorized to update this review");
  }

  const result = await ProductReview.findByIdAndUpdate(
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

  return result;
};

const deleteProductReviewFromDB = async (user: JwtPayload, id: string) => {
  const currentUser = await User.isUserExistsByEmail(user.email);
  if (!currentUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const reviewData = await ProductReview.findOne({ _id: id, isDeleted: false });
  if (!reviewData) {
    throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  }

  // Only the review owner or an admin/super admin can soft delete
  const isOwner = reviewData.customer.toString() === currentUser._id?.toString();
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";

  if (!isOwner && !isAdmin) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not authorized to delete this review");
  }

  const result = await ProductReview.findByIdAndUpdate(
    id,
    { $set: { isDeleted: true } },
    { new: true }
  );

  return result;
};

const allReviewsByProductFromDB = async (id: string, query: Record<string, unknown>) => {
  const reviewProductQuery = new QueryBuilder(ProductReview.find().populate("customer")
    .populate({
      path: "customerDetails",
      select: "name avatar",
    })
    .populate("product")
    .populate("order"), query)
    .search([])
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await reviewProductQuery.countTotal();
  const data = await reviewProductQuery.modelQuery;

  const totalRatings = data?.reduce((sum, review) => sum + review.rating, 0);
  const averageRating =
    data.length > 0 ? (totalRatings / data.length).toFixed(2) : "0.00";




  return {
    meta,
    data,
    averageRating,
    totalRatings
  };
};




export const ProductReviewServices = {
  createProductReviewIntoDB,
  updateProductReviewInDB,
  deleteProductReviewFromDB,
  allReviewsByProductFromDB,
};
