import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Customer } from "../customer/customer.model";
import { TProductReview, TShopReview } from "./review.interface";
import { Order } from "../order/order.model";
import { ShopProduct } from "../shopProduct/shopProduct.model";
import { ProductReview, ShopReview } from "./review.model";
import QueryBuilder from "../../builder/queryBuilder";
import { Shop } from "../shop/shop.model";

const createProductReviewIntoDB = async (payload: TProductReview) => {
  const isCustomer = await Customer.findById(payload.customer);
  if (!isCustomer) {
    throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
  }

  const isOrder = await Order.findById(payload?.order);

  if (!isOrder) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  const isProduct = await ShopProduct.findById(payload.product);

  if (!isProduct) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  const existingReview = await ProductReview.findOne({
    customer: isCustomer._id,
    product: isProduct._id,
  });

  if (existingReview) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "You have already reviewed this product"
    );
  }

  const result = await ProductReview.create(payload);
  return result;
};

const singleProductReviewsFromDB = async (
  id: string,
  query: Record<string, unknown>
) => {
  const isProduct = await ShopProduct.findById(id);
  if (!isProduct) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }
  const productReviewQuery = new QueryBuilder(
    ProductReview.find({ product: isProduct._id })
      .populate("customer", "name")
      .populate("product", "title"),
    query
  )
    .filter()
    .fields()
    .sort()
    .paginate();

  const meta = await productReviewQuery.countTotal();
  const data = await productReviewQuery.modelQuery;

  const totalRatings = data?.reduce((sum, review) => sum + review.rating, 0);
  const averageRating =
    data.length > 0 ? (totalRatings / data.length).toFixed(2) : "0.00";

  return {
    meta,
    data,
    averageRating,
    totalRatings,
  };
};

const updateProductReviewIntoDB = async (
  id: string,
  payload: Partial<TProductReview>
) => {
  const isReviewExists = await ProductReview.findById(id);

  if (!isReviewExists) {
    throw new AppError(httpStatus.NOT_FOUND, "this review not found");
  }

  const result = await ProductReview.findByIdAndUpdate(
    isReviewExists._id,
    payload,
    { new: true, runValidators: true }
  );

  return result;
};

const createShopReviewIntoDB = async (email: string, payload: TShopReview) => {
  const isCustomer = await Customer.findOne({ email });
  if (!isCustomer) {
    throw new AppError(httpStatus.NOT_FOUND, "this customer not found");
  }

  const isOrder = await Order.findById(payload?.order);

  if (!isOrder) {
    throw new AppError(httpStatus.NOT_FOUND, "this Order not found");
  }

  if (!isCustomer._id.equals(isOrder.customer._id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "this order not your");
  }

  const reviewData = {
    customer: isOrder.customer,
    order: isOrder._id,
    shop: isOrder.shop,
    feedback: payload.feedback,
    rating: payload.rating,
  };

  const result = await ShopReview.create(reviewData);

  return result;
};

const singleShopReviewsFromDB = async (
  id: string,
  query: Record<string, unknown>
) => {
  const isShop = await Shop.findById(id);
  if (!isShop) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }
  const shopReviewQuery = new QueryBuilder(
    ShopReview.find({ shop: isShop._id })
      .populate("customer", "name")
      .populate("shop", "shopName"),
    query
  )
    .filter()
    .fields()
    .sort()
    .paginate();

  const meta = await shopReviewQuery.countTotal();
  const data = await shopReviewQuery.modelQuery;

  const totalRatings = data?.reduce((sum, review) => sum + review.rating, 0);
  const averageRating =
    data.length > 0 ? (totalRatings / data.length).toFixed(2) : "0.00";

  return {
    meta,
    data,
    averageRating,
    totalRatings,
  };
};

export const ReviewServices = {
  createProductReviewIntoDB,
  singleProductReviewsFromDB,
  updateProductReviewIntoDB,
  createShopReviewIntoDB,
  singleShopReviewsFromDB,
};
