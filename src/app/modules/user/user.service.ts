import mongoose from "mongoose"
import { USER_ROLE } from "../../interface/common"
import { TImageFile, TImageFiles } from "../../interface/image.interface"
import { TAdmin } from "../admin/admin.interface"
import { User } from "./user.model"
import AppError from "../../errors/AppError"
import httpStatus from "http-status"
import { Admin } from "../admin/admin.model"
import { TVendor } from "../vendor/vendor.interface"
import { TUser } from "./user.interface"
import { Vendor } from "../vendor/vendor.model"

const createAdminIntoDB = async (image: TImageFile, password: string, payload: TAdmin) => {
    const userData: Partial<TUser> = {
        name: payload?.name,
        email: payload?.email,
        password: password,
        role: USER_ROLE?.ADMIN,
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


const createVendorIntoDB = async (images: TImageFiles, password: string, payload: TVendor) => {

    const logo = images?.logo[0];
    const banner = images?.banner[0];

    if (logo && logo.path) {
        payload.logo = logo.path;
    }

    if (banner && banner?.path) {
        payload.banner = banner?.path
    }

    const userData: Partial<TUser> = {
        name: payload?.name,
        email: payload?.email,
        password: password,
        role: USER_ROLE?.VENDOR,
    };

    const session = await mongoose.startSession();

    try {
        session.startTransaction();

        const newUser = await User.create([userData], { session })

        if (!newUser.length) {
            throw new AppError(httpStatus.BAD_REQUEST, "Failed to create user");
        }
        payload.user = newUser[0]._id;

        const newVendor = await Vendor.create([payload], { session });

        if (!newVendor.length) {
            throw new AppError(httpStatus.BAD_REQUEST, "Failed to create user");
        }
        await session.commitTransaction();
        await session.endSession();

        return newVendor;
    } catch (error: any) {
        await session.abortTransaction();
        await session.endSession();
        throw new Error(error)
    }

}

export const UserServices = {
    createAdminIntoDB,
    createVendorIntoDB
}