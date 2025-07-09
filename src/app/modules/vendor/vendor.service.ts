import mongoose, { FilterQuery, startSession } from "mongoose";
import QueryBuilder from "../../builder/queryBuilder";
import { sellerSearchableFields } from "./vendor.const";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { User } from "../user/user.model";
import { TUser } from "../user/user.interface";
import { TVendor } from "./vendor.interface";
import { Vendor } from "./vendor.model";

const allVendorsFromDB = async (query: Record<string, unknown>) => {
  const vendorQuery = new QueryBuilder(Vendor.find(), query)
    .search(sellerSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await vendorQuery.countTotal();
  const data = await vendorQuery.modelQuery;

  return { meta, data };
};

const singleVendorFromDB = async (id: string) => {
  const result = await Vendor.findById(id);

  return result;
};

const deleteVendorFromDB = async (id: string) => {
  const session = await mongoose.startSession();

  try {
    const deletedVendor = await Vendor.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true, session }
    );

    if (!deletedVendor) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to delete seller");
    }

    const userId = deletedVendor.user;
    const deletedUser = await User.findByIdAndUpdate(
      userId,
      { isDeleted: true },
      { new: true, session }
    );

    if (!deletedUser) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to delete user");
    }

    await session.commitTransaction();
    await session.endSession();

    return deletedVendor;
  } catch (error: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(error);
  }
};

const updateVendorIntoDB = async (id: string, payload: Partial<TVendor>) => {
  console.log("payload", payload);
  const userData: Partial<TUser> = {
    name: payload.name,
    email: payload.email,
  };

  const session = await startSession();
  session.startTransaction();

  try {
    const { address, ...remainingData } = payload;

    const modifiedData: Record<string, unknown> = {
      ...remainingData,
    };

    const isVendor = await Vendor.findById(id).session(session);

    if (!isVendor) {
      throw new AppError(httpStatus.NOT_FOUND, "Vendor not found");
    }

    if (address && Object.keys(address).length) {
      for (const [key, value] of Object.entries(address)) {
        modifiedData[`address.${key}`] = value;
      }
    }

    // Get lat/lon from geocoding
    const updateUser = await User.findByIdAndUpdate(isVendor?.user, userData, {
      new: true,
      session,
      runValidators: true,
    });

    if (!updateUser) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to update user");
    }

    const updateVendor = await Vendor.findByIdAndUpdate(id, modifiedData, {
      new: true,
      session,
      runValidators: true,
    });

    await session.commitTransaction();
    await session.endSession();

    return updateVendor;
  } catch (error: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(error);
  }
};

export const VendorServices = {
  allVendorsFromDB,
  singleVendorFromDB,
  deleteVendorFromDB,
  updateVendorIntoDB,
};
