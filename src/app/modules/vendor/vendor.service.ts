import httpStatus from "http-status";
import QueryBuilder from "../../builder/queryBuilder"
import AppError from "../../errors/AppError";
import { Vendor } from "./vendor.model"
import { User } from "../user/user.model";
import mongoose from "mongoose";

const allVendorsFromDB = async (query: Record<string, unknown>) => {
    const vendorsQuery = new QueryBuilder(Vendor.find(), query)
        .search([])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await vendorsQuery.countTotal();
    const data = await vendorsQuery.modelQuery;

    return {
        meta,
        data
    }
}


const vendorFromDB = async (id: string) => {
    const isVendorExists = await Vendor.findById(id);
    if (isVendorExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this vendor not found")
    }

    return isVendorExists;
}

const deleteVendorFromDB = async (id: string) => {
    const session = await mongoose.startSession();

    try {
        const deletedVendor = await Vendor.findByIdAndUpdate(
            id,
            { isDeleted: true },
            { new: true, session }
        );

        if (!deletedVendor) {
            throw new AppError(httpStatus.BAD_REQUEST, "Failed to delete vendor");
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

export const VendorServices = {
    allVendorsFromDB,
    vendorFromDB,
    deleteVendorFromDB
}