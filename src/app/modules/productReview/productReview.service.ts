import { JwtPayload } from "jsonwebtoken";
import { User } from "../user/user.model";
import { TProductReview } from "./productReview.interface";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { Variant } from "../variant/variant.model";
import { Order } from "../order/order.model";
import { ProductReview } from "./productReview.model";
import QueryBuilder from "../../builder/queryBuilder";
import { ORDER_STATUS } from "../../interface/common";

const createProductReviewIntoDB = async (user: JwtPayload, payload: Partial<TProductReview>) => {
  const isUser = await User.isUserExistsByEmail(user.email);
  if (!isUser) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
  }

  const isOrder = await Order.findById(payload.order);

  if (!isOrder) {
    throw new AppError(httpStatus.NOT_FOUND, "This order not found");
  }

  const isproduct = await Variant.findById(payload.product);

  if (!isproduct) {
    throw new AppError(httpStatus.NOT_FOUND, "This product not found");
  }

  if (isOrder?.status !== ORDER_STATUS.DELIVERED) {

    throw new AppError(httpStatus.BAD_REQUEST, "you can only review this product after order delivered")

  }

  // Prevent duplicate reviews for the same product by the same customer
  const existingReview = await ProductReview.findOne({
    customer: isUser._id,
    product: payload.product,
    isDeleted: false,
  });

  if (existingReview) {
    throw new AppError(httpStatus.BAD_REQUEST, "You have already reviewed this product");
  }


  const result = await ProductReview.create(payload);

  return result;
};

const updateProductReviewInDB = async (
  user: JwtPayload,
  id: string,
  payload: Partial<TProductReview>
) => {
  const isUser = await User.isUserExistsByEmail(user.email);
  if (!isUser) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
  }

  const review = await ProductReview.findOne({ _id: id, isDeleted: false });
  if (!review) {
    throw new AppError(httpStatus.NOT_FOUND, "Review not found");
  }

  // Check same customer
  if (review.customer.toString() !== isUser._id.toString()) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not authorized to update this review");
  }

  // Check same order
  if (payload.order && review.order.toString() !== payload.order.toString()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Cannot change the order associated with this review");
  }

  // Check same product
  if (payload.product && review.product.toString() !== payload.product.toString()) {
    throw new AppError(httpStatus.BAD_REQUEST, "Cannot change the product associated with this review");
  }

  const result = await ProductReview.findByIdAndUpdate(
    id,
    payload,
    { new: true, runValidators: true }
  );

  return result;
};


const allReviewsByProductFromDB = async (id: string, query: Record<string, unknown>) => {
  const reviewProductQuery = new QueryBuilder(ProductReview.find({ product: id, isDeleted: false }).populate("customer")
    .populate("user", 'name email')
    .populate("variant")
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
  allReviewsByProductFromDB,
};

