import mongoose from "mongoose";
import QueryBuilder from "../../builder/queryBuilder";
import { Admin } from "./admin.model";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { User } from "../user/user.model";
import { adminSearchableFields } from "../../utilities/constant";

const allAdminsFromDB = async (query: Record<string, unknown>) => {
  const adminQuery = new QueryBuilder(
    Admin.find().populate("user", "role password status needsPasswordChange"),
    query
  )
    .search(adminSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await adminQuery.countTotal();
  const data = await adminQuery.modelQuery;

  return { meta, data };
};

const singleAdminFromDB = async (id: string) => {
  const result = await Admin.findById(id);

  return result;
};

const deleteAdminFromDB = async (id: string) => {
  const session = await mongoose.startSession();

  try {
    const deletedAdmin = await Admin.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true, session }
    );

    if (!deletedAdmin) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to delete admin");
    }

    const userId = deletedAdmin.user;
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

    return deletedAdmin;
  } catch (error: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(error);
  }
};

export const AdminServices = {
  allAdminsFromDB,
  singleAdminFromDB,
  deleteAdminFromDB,
};
