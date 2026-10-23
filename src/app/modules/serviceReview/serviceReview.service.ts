import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import QueryBuilder from "../../builder/queryBuilder";
import { TServiceReview } from "./serviceReview.interface";
import { ServiceReview } from "./serviceReview.model";
import { Vendor } from "../vendor/vendor.model";

import mongoose from "mongoose";
import { User } from "../user/user.model";
import { JwtPayload } from "jsonwebtoken";

const createServiceReviewIntoDB = async (user: JwtPayload, payload: TServiceReview) => {
  const isUser = await User.isUserExistsByEmail(user?.email);

  if (!isUser) {
    throw new AppError(httpStatus.NOT_FOUND, "this user not found")
  }
  const data = {
    customer: isUser._id,
    vendor: payload.vendor,
    order: payload.order,
    rating: payload.rating,
    review: payload.review,
  }

  const result = await ServiceReview.create(data);
  return result;
};

const allServiceReviewsByVendorFromDB = async (
  id: string,
  query: Record<string, unknown>
) => {
  const isUser = await User.findById(id);

  if (!isUser) {
    throw new AppError(httpStatus.NOT_FOUND, "this user not found");
  }

  const serviceReviewQuery = new QueryBuilder(
    ServiceReview.find({ vendor: isUser?._id, isDeleted: { $ne: true } })
      .populate("customer", "name email avatar")
      .populate("vendor")
      .populate("order"),
    query
  )
    .search(["review"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await serviceReviewQuery.countTotal();
  const data = await serviceReviewQuery.modelQuery;

  return { meta, data };
};

export const ServiceReviewServices = {
  createServiceReviewIntoDB,
  allServiceReviewsByVendorFromDB,
};
