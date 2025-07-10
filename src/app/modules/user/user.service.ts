import httpStatus from "http-status";
import QueryBuilder from "../../builder/queryBuilder";
import { USER_ROLE, UserSearchableFields } from "./user.const";
import { User } from "./user.model";
import { TAdmin } from "../admin/admin.interface";
import { TImageFile } from "../../interface/image.interface";
import { TUser } from "./user.interface";
import config from "../../config";
import mongoose from "mongoose";
import AppError from "../../errors/AppError";
import { Admin } from "../admin/admin.model";
import { TCustomer } from "../customer/customer.interface";
import { Customer } from "./../customer/customer.model";
import { TVendor } from "../vendor/vendor.interface";
import { Vendor } from "../vendor/vendor.model";
import { Shop } from "../shop/shop.model";

const createAdminIntoDB = async (
  image: TImageFile,
  password: string,
  payload: TAdmin
) => {
  const userData: Partial<TUser> = {
    name: payload.name,
    email: payload.email,
    password: password || (config.default_password as string),
    role: USER_ROLE?.ADMIN,
  };

  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    if (image && image.path) {
      payload.avatar = image.path;
    }

    const newUser = await User.create([userData], { session });

    if (!newUser?.length) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to create user");
    }

    payload.user = newUser[0]._id;

    const newAdmin = await Admin.create([payload], { session });
    if (!newAdmin.length) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to create admin");
    }

    await session.commitTransaction();
    await session.endSession();

    return newAdmin;
  } catch (error: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(error);
  }
};

const createVendorIntoDB = async (password: string, payload: TVendor) => {
  const userData: Partial<TUser> = {
    name: payload?.name,
    email: payload?.email,
    password: password || (config.default_password as string),
    role: USER_ROLE?.VENDOR,
  };

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1. Create user
    const newUser = await User.create([userData], { session });
    if (!newUser?.length) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to create user");
    }
    payload.user = newUser[0]._id;

    // 5. Create seller
    const newVendor = await Vendor.create([payload], { session });
    if (!newVendor.length) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to create vendor");
    }

    // 6. Commit transaction & end session
    await session.commitTransaction();
    await session.endSession();

    return newVendor;
  } catch (error: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(error);
  }
};

const createCustomerIntoDB = async (password: string, payload: TCustomer) => {
  const userData: Partial<TUser> = {
    name: payload.name,
    email: payload.email,
    password: password || (config.default_password as string),
    role: USER_ROLE?.CUSTOMER,
  };

  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    // if (image && image.path) {
    //   payload.avatar = image.path;
    // }

    const newUser = await User.create([userData], { session });

    if (!newUser?.length) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to create user");
    }

    payload.user = newUser[0]._id;

    const newCustomer = await Customer.create([payload], { session });

    if (!newCustomer.length) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to create customer");
    }

    await session.commitTransaction();
    await session.endSession();

    return newCustomer;
  } catch (error: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(error);
  }
};

const getAllUsersFromDB = async (query: Record<string, unknown>) => {
  const userQuery = new QueryBuilder(User.find(), query)
    .search(UserSearchableFields)
    .fields()
    .paginate()
    .sort()
    .filter();

  const meta = await userQuery.countTotal();
  const data = await userQuery.modelQuery;

  return {
    meta,
    data,
  };
};

const getSingleUserFromDB = async (email: string) => {
  const user = await User.find({ email });
  return user;
};

const shopStatusChangeFromDB = async (
  id: string,
  status: { isSuspended: boolean }
) => {
  const isShop = await Shop.findById(id);

  if (!isShop) {
    throw new AppError(httpStatus.NOT_FOUND, "Shop not found");
  }

  const isSuspended = isShop.isSuspended;

  if (isSuspended) {
    throw new AppError(httpStatus.BAD_REQUEST, "Shop already suspended");
  }

  const result = await Shop.findByIdAndUpdate(
    isShop?.id,
    { isSuspended: status?.isSuspended },
    {
      new: true,
      runValidators: true,
    }
  );

  console.log(result);

  return result;
};

export const UserServices = {
  createAdminIntoDB,
  createVendorIntoDB,
  createCustomerIntoDB,
  getAllUsersFromDB,
  getSingleUserFromDB,
  shopStatusChangeFromDB,
};
