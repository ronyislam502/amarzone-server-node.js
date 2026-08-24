import httpStatus from "http-status";
import QueryBuilder from "../../builder/queryBuilder"
import AppError from "../../errors/AppError";
import { Admin } from "./admin.model"
import mongoose from "mongoose";
import { User } from "../user/user.model";
import { TAdmin } from "./admin.interface";
import { TImageFile } from "../../interface/image.interface";

const allAdminsFromDB = async (query: Record<string, unknown>) => {
    const adminsQuery = new QueryBuilder(Admin.find(), query)
        .search([])
        .filter()
        .sort()
        .paginate()
        .fields()


    const meta = await adminsQuery.countTotal();
    const data = await adminsQuery.modelQuery;

    return { meta, data }
}


const adminFromDB = async (id: string) => {
    const result = await Admin.findById(id).populate("user");

    if (!result) {
        throw new AppError(httpStatus.NOT_FOUND, "Admin not found");
    }

    return result;
};

const updateAdminIntoDB = async (
    id: string,
    image: TImageFile,
    payload: Partial<TAdmin>
) => {
    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        // check admin existence
        const isAdminExists = await Admin.findById(id).session(session);
        if (!isAdminExists) {
            throw new AppError(httpStatus.NOT_FOUND, "Admin not found");
        }

        // image set
        if (image && image.path) {
            payload.avatar = image.path;
        }

        // update related user
        const updatedUser = await User.findByIdAndUpdate(
            isAdminExists.user,
            payload,
            { new: true, session }
        );

        if (!updatedUser) {
            throw new AppError(httpStatus.BAD_REQUEST, "Failed to update user");
        }

        // update admin
        const updatedAdmin = await Admin.findByIdAndUpdate(
            isAdminExists._id,
            payload,
            { new: true, session }
        );

        if (!updatedAdmin) {
            throw new AppError(httpStatus.BAD_REQUEST, "Failed to update admin");
        }

        await session.commitTransaction();
        await session.endSession();

        return updatedAdmin;
    } catch (error: any) {
        await session.abortTransaction();
        await session.endSession();
        throw new Error(error);
    }
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
    adminFromDB,
    deleteAdminFromDB
}
