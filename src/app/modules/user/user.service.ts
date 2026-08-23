import mongoose from "mongoose"
import { USER_ROLE } from "../../interface/common"
import { TImageFile } from "../../interface/image.interface"
import { TAdmin } from "../admin/admin.interface"
import { User } from "./user.model"
import AppError from "../../errors/AppError"
import httpStatus from "http-status"
import { Admin } from "../admin/admin.model"

const createAdminIntoDB = async (image: TImageFile, password: string, payload: TAdmin) => {
    const userData = {
        name: payload.name,
        email: payload.email,
        password: password,
        role: USER_ROLE.ADMIN,
    }

    const session = await mongoose.startSession();

    try {
        session.startTransaction();
        if (image && image.path) {
            payload.avatar = image.path;
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

}

export const UserServices = {
    createAdminIntoDB
}