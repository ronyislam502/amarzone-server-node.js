import mongoose from "mongoose"
import QueryBuilder from "../../builder/queryBuilder"
import { USER_ROLE, USER_STATUS } from "../../interface/common"
import { TImageFile, TImageFiles } from "../../interface/image.interface"
import { TAdmin } from "../admin/admin.interface"
import { User } from "./user.model"
import AppError from "../../errors/AppError"
import httpStatus from "http-status"
import { Admin } from "../admin/admin.model"
import { TVendor } from "../vendor/vendor.interface"
import { TUser } from "./user.interface"
import { Vendor } from "../vendor/vendor.model"
import { Customer } from "../customer/customer.model"
import { TCustomer } from "../customer/customer.interface"
import { JwtPayload } from "jsonwebtoken"

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

const createCustomerIntoDB = async (image: TImageFile, password: string, payload: TCustomer) => {
    const userData: Partial<TUser> = {
        name: payload.name,
        email: payload.email,
        password: password,
        role: USER_ROLE?.CUSTOMER,
    };

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

        const newCustomer = await Customer.create([payload], { session });

        if (!newCustomer.length) {
            throw new AppError(httpStatus.BAD_REQUEST, "Failed to create customer");
        }

        await session.commitTransaction();
        await session.endSession();

        return newCustomer;
    } catch (error: any) {
        await session.abortTransaction();
        await session.endSession();
        throw new Error(error);
    }
};

// const getAllUsersFromDB = async (query: Record<string, unknown>) => {
//     const userQuery = new QueryBuilder(User.find(), query)
//         .search(["name", "email"])
//         .filter()
//         .sort()
//         .paginate()
//         .fields();

//     const result = await userQuery.modelQuery;
//     const meta = await userQuery.countTotal();

//     const usersWithDetails = await Promise.all(
//         result.map(async (user) => {
//             const userObj = user.toObject();
//             let details = null;

//             if (userObj.role === USER_ROLE.ADMIN || userObj.role === USER_ROLE.SUPER_ADMIN) {
//                 details = await Admin.findOne({ user: userObj._id }).lean();
//             } else if (userObj.role === USER_ROLE.VENDOR) {
//                 details = await Vendor.findOne({ user: userObj._id }).lean();
//             } else if (userObj.role === USER_ROLE.CUSTOMER) {
//                 details = await Customer.findOne({ user: userObj._id }).lean();
//             }

//             return {
//                 ...userObj,
//                 details
//             };
//         })
//     );

//     return {
//         meta,
//         result: usersWithDetails
//     };
// };

const getMyProfileFromDB = async (user: JwtPayload) => {
    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    if (isUserExists.status === USER_STATUS.BLOCKED || isUserExists.status === USER_STATUS.SUSPENDED) {
        throw new AppError(httpStatus.FORBIDDEN, `This user is ${isUserExists.status.toLowerCase()}!`);
    }

    if (isUserExists.isDeleted) {
        throw new AppError(httpStatus.FORBIDDEN, "This user account is deleted!");
    }

    let profileInfo = null;

    if (isUserExists.role === USER_ROLE.SUPER_ADMIN || user.role === USER_ROLE.ADMIN) {
        profileInfo = await Admin.findOne({ email: isUserExists.email }).populate("user");
    } else if (isUserExists.role === USER_ROLE.VENDOR) {
        profileInfo = await Vendor.findOne({ email: isUserExists.email }).populate("user");
    } else if (isUserExists.role === USER_ROLE.CUSTOMER) {
        profileInfo = await Customer.findOne({ email: isUserExists.email }).populate("user");
    }

    return profileInfo
};

export const UserServices = {
    createAdminIntoDB,
    createVendorIntoDB,
    createCustomerIntoDB,
    // getAllUsersFromDB,
    getMyProfileFromDB
}