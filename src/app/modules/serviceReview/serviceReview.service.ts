import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import QueryBuilder from "../../builder/queryBuilder";
import { TServiceReview } from "./serviceReview.interface";
import { ServiceReview } from "./serviceReview.model";
import { Vendor } from "../vendor/vendor.model";

const createServiceReviewIntoDB = async (payload: TServiceReview) => {
  const result = await ServiceReview.create(payload);
  return result;
};

const allServiceReviewsByVendorFromDB = async (
  id: string,
  query: Record<string, unknown>
) => {
  const isVendor = await Vendor.findById(id);

  if (!isVendor) {
    throw new AppError(httpStatus.NOT_FOUND, "Vendor not found");
  }

  const serviceReviewQuery = new QueryBuilder(
    ServiceReview.find({ vendor: isVendor._id }).populate("customer").populate("vendor").populate("order"),
    query
  )
    .search(["title", "review"])
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
