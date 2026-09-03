import httpStatus from "http-status";
import QueryBuilder from "../../builder/queryBuilder"
import AppError from "../../errors/AppError";
import { Vendor } from "./vendor.model"
import { User } from "../user/user.model";
import mongoose from "mongoose";
import { TImageFiles } from "../../interface/image.interface";
import { TVendor } from "./vendor.interface";

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

const updateVendorIntoDB = async (
    id: string,
    images: TImageFiles,
    payload: Partial<TVendor>
) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        // check admin existence
        const isVendor = await Vendor.findById(id).session(session);
        if (!isVendor) {
            throw new AppError(httpStatus.NOT_FOUND, "Vendor not found");
        }

        const logo = images?.logo[0];
        const banner = images?.banner[0];

        if (logo && logo.path) {
            payload.logo = logo.path;
        }

        if (banner && banner?.path) {
            payload.banner = banner?.path
        }


        // update related user
        const updatedUser = await User.findByIdAndUpdate(
            isVendor.user,
            payload,
            { new: true, session }
        );

        if (!updatedUser) {
            throw new AppError(httpStatus.BAD_REQUEST, "Failed to update user");
        }

        // update admin
        const updatedVendor = await Vendor.findByIdAndUpdate(
            isVendor._id,
            payload,
            { new: true, session }
        );

        if (!updatedVendor) {
            throw new AppError(httpStatus.BAD_REQUEST, "Failed to update vendor");
        }

        await session.commitTransaction();
        await session.endSession();

        return updatedVendor;
    } catch (error: any) {
        await session.abortTransaction();
        await session.endSession();
        throw new Error(error);
    }
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
    updateVendorIntoDB,
    deleteVendorFromDB
}