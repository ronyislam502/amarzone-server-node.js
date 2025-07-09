import mongoose from "mongoose";
import QueryBuilder from "../../builder/queryBuilder";
import { customerSearchableFields } from "./customer.const";
import { Customer } from "./customer.model";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { User } from "../user/user.model";

const allCustomersFromDB = async (query: Record<string, unknown>) => {
  const customerQuery = new QueryBuilder(Customer.find(), query)
    .search(customerSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await customerQuery.countTotal();
  const data = await customerQuery.modelQuery;

  return { meta, data };
};

const singleCustomerFromDB = async (id: string) => {
  const result = await Customer.findById(id);

  return result;
};

const deleteCustomerFromDB = async (id: string) => {
  const session = await mongoose.startSession();

  try {
    const deletedCustomer = await Customer.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true, session }
    );

    if (!deletedCustomer) {
      throw new AppError(httpStatus.BAD_REQUEST, "Failed to delete customer");
    }

    const userId = deletedCustomer.user;
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

    return deletedCustomer;
  } catch (error: any) {
    await session.abortTransaction();
    await session.endSession();
    throw new Error(error);
  }
};

export const CustomerServices = {
  allCustomersFromDB,
  singleCustomerFromDB,
  deleteCustomerFromDB,
};
