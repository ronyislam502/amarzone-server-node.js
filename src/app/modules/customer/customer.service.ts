import httpStatus from "http-status";
import QueryBuilder from "../../builder/queryBuilder"
import AppError from "../../errors/AppError";
import { Customer } from "./customer.model"
import mongoose from "mongoose";
import { User } from "../user/user.model";

const allCustomersFromDB = async (query: Record<string, unknown>) => {
    const customersQuery = new QueryBuilder(Customer.find(), query)
        .search([''])
        .filter()
        .sort()
        .paginate()
        .fields()

    const meta = await customersQuery.countTotal();
    const data = await customersQuery.modelQuery;

    return { meta, data }
}

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
    deleteCustomerFromDB
}