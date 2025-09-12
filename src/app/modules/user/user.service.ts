import httpStatus from "http-status";
import QueryBuilder from "../../builder/queryBuilder";
import { User } from "./user.model";
import { TAdmin } from "../admin/admin.interface";
import { TImageFile, TImageFiles } from "../../interface/image.interface";
import { TUser } from "./user.interface";
import config from "../../config";
import mongoose from "mongoose";
import AppError from "../../errors/AppError";
import { Admin } from "../admin/admin.model";
import { USER_ROLE, UserSearchableFields } from "../../utilities/const";
import { TStaff } from "../staff/staff.interface";

const createAdminIntoDB = async (
  images: TImageFiles,
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

    const avatar = images?.avatar[0];
    const nidImgs = images?.nidImg;

    if (avatar && avatar.path) {
      payload.avatar = avatar.path;
    }

    if (nidImgs) {
      payload.nidImg = nidImgs?.map((file) => file.path);
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

const createStaffIntoDB = async (
  images: TImageFiles,
  password: string,
  payload: TStaff
) => {
  const userData: Partial<TUser> = {
    name: payload.name,
    email: payload.email,
    password: password || (config.default_password as string),
    role: USER_ROLE?.STAFF,
  };

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const avatar = images?.avatar[0];
    const nidImgs = images?.nidImg;

    if (avatar && avatar.path) {
      payload.avatar = avatar.path;
    }

    if (nidImgs) {
      payload.nidImg = nidImgs?.map((file) => file.path);
    }

    const newUser = await User.create([userData], { session });

    if (!newUser?.length) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to create user");
    }

    payload.user = newUser[0]._id;

    const newStaff = await Admin.create([payload], { session });
    if (!newStaff.length) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to create admin");
    }

    await session.commitTransaction();
    await session.endSession();

    return newStaff;
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

export const UserServices = {
  createAdminIntoDB,
  createStaffIntoDB,
  getAllUsersFromDB,
};
