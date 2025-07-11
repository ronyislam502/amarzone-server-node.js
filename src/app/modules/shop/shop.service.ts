import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { TShop } from "./shop.interface";
import { Shop } from "./shop.model";
import QueryBuilder from "../../builder/queryBuilder";
import { Vendor } from "./../vendor/vendor.model";

const createShopIntoDB = async (payload: TShop) => {
  const isVendor = await Vendor.findById(payload?.vendor);
  if (!isVendor) {
    throw new AppError(httpStatus.NOT_FOUND, "Vendor not found");
  }

  const alreadyIsShopped = isVendor.isShoped;

  if (alreadyIsShopped) {
    throw new AppError(httpStatus.BAD_REQUEST, "already created shop!");
  }
  const result = await Shop.create(payload);
  await Vendor.findByIdAndUpdate(isVendor.id, { isShoped: true });

  return result;
};

const allShopsFromDB = async (query: Record<string, unknown>) => {
  const shopQuery = new QueryBuilder(Shop.find().populate("vendor"), query)
    .search(["shopName", "shopEmail", "shopPhone"])
    .filter()
    .sort()
    .fields();

  const meta = await shopQuery.countTotal();
  const data = await shopQuery.modelQuery;

  return { meta, data };
};

const myShopFromDB = async (email: string) => {
  const isVendor = await Vendor.findOne({ email });
  if (!isVendor) {
    throw new AppError(httpStatus.NOT_FOUND, "Vendor not found");
  }

  const result = await Shop.findOne({
    vendor: isVendor?._id,
  }).populate("vendor");

  return result;
};

export const ShopServices = {
  createShopIntoDB,
  allShopsFromDB,
  myShopFromDB,
};
