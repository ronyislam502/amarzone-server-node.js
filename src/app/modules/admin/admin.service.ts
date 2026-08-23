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
