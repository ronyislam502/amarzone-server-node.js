import httpStatus from "http-status";
import QueryBuilder from "../../builder/queryBuilder"
import AppError from "../../errors/AppError";
import { Customer } from "./customer.model"
import mongoose from "mongoose";
import { User } from "../user/user.model";
import { TCustomer } from "./customer.interface";
import { TImageFile } from "../../interface/image.interface";

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

const updateCustomerIntoDB = async (id: string, image: TImageFile, payload: Partial<TCustomer>) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const isCustomer = await Customer.findById(id).session(session);

        if (!isCustomer) {
            throw new AppError(httpStatus.NOT_FOUND, "Customer not found");
        }

        const { address, ...remainingData } = payload;
        const modifiedData: Record<string, unknown> = { ...remainingData };


        if (address && Object.keys(address).length) {
            for (const [key, value] of Object.entries(address)) {
                modifiedData[`address.${key}`] = value;
            }
        }

        // Relation user: only name field is updateable
        if (payload.name) {
            const updatedUser = await User.findByIdAndUpdate(
                isCustomer.user,
                { name: payload.name },
                {
                    new: true,
                    session,
                    runValidators: true,
                }
            );

            if (!updatedUser) {
                throw new AppError(httpStatus.BAD_REQUEST, "Failed to update user");
            }
        }

        const updatedCustomer = await Customer.findByIdAndUpdate(
            isCustomer._id,
            modifiedData,
            {
                new: true,
                session,
                runValidators: true,
            }
        );

        if (!updatedCustomer) {
            throw new AppError(httpStatus.BAD_REQUEST, "Failed to update customer");
        }

        await session.commitTransaction();
        await session.endSession();

        return updatedCustomer;
    } catch (error: any) {
        await session.abortTransaction();
        await session.endSession();
        throw error;
    }
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
    deleteCustomerFromDB,
    updateCustomerIntoDB
}