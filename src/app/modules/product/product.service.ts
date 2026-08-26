import httpStatus from "http-status";
import { Product } from "./product.model";
import { TProduct } from "./product.interface";
import AppError from "../../errors/AppError";
import { Department } from "../department/department.model";
import { Category } from "../category/category.model";
import { User } from "../user/user.model";
import { JwtPayload } from "jsonwebtoken";
import { USER_ROLE, USER_STATUS } from "../../interface/common";
import { TImageFile } from "../../interface/image.interface";

const createProductIntoDB = async (
    user: JwtPayload,
    image: TImageFile,
    payload: TProduct
) => {
    const isUserExists = await User.isUserExistsByEmail(user?.email);
    console.log("user", isUserExists)

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "This user not found");
    }

    if (isUserExists.status === USER_STATUS.SUSPENDED) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "User is suspended! Cannot create product"
        );
    }

    const author = {
        role: isUserExists.role,
        name:
            isUserExists.name ||
            (isUserExists.role === USER_ROLE.SUPER_ADMIN
                ? "Super Admin"
                : "Admin"),
    };

    const isDepartment = await Department.findById(payload?.department);

    if (!isDepartment) {
        throw new AppError(httpStatus.NOT_FOUND, "Department not found");
    }

    const isCategory = await Category.findById(payload?.category);

    if (!isCategory) {
        throw new AppError(httpStatus.NOT_FOUND, "Category not found");
    }

    if (isDepartment._id.toString() !== isCategory?.department?.toString()) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Selected category does not belong to the selected department."
        );
    }

    if (image && image.path) {
        payload.thumbnail = image.path
    }

    const newProduct = {
        ...payload,
        author,
        isDeleted: false,
    };

    const result = await Product.create(newProduct);

    return result;
};


const productFromDB = async (id: string) => {
    const isProductExists = await Product.findById(id);

    if (!isProductExists) {
        throw new AppError(httpStatus.NOT_FOUND, "this product not found")
    }

    return isProductExists;
}
const updateProductIntoDB = async (
    user: JwtPayload,
    id: string,
    image: TImageFile,
    payload: Partial<TProduct>
) => {

    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "This user not found");
    }

    if (isUserExists.status === USER_STATUS.SUSPENDED) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "User is suspended! Cannot update product"
        );
    }


    const isProductExists = await Product.findById(id);

    if (!isProductExists) {
        throw new AppError(httpStatus.NOT_FOUND, "This product not found");
    };

    if (
        isUserExists.role === USER_ROLE.VENDOR &&
        isProductExists.author.name !== isUserExists.name
    ) {
        throw new AppError(
            httpStatus.UNAUTHORIZED,
            "You are not authorized to update this product"
        );
    }

    const isDepartment = await Department.findById(payload.department);
    if (!isDepartment) {
        throw new AppError(httpStatus.NOT_FOUND, "Department not found");
    }

    const isCategory = await Category.findById(payload.category);
    if (!isCategory) {
        throw new AppError(httpStatus.NOT_FOUND, "Category not found");
    }

    if (isDepartment._id.toString() !== isCategory?.department?.toString()) {
        throw new AppError(
            httpStatus.BAD_REQUEST,
            "Selected category does not belong to the selected department."
        );
    }

    if (image && image.path) {
        payload.thumbnail = image.path;
    }

    const result = await Product.findByIdAndUpdate(isProductExists._id, payload, {
        new: true,
        runValidators: true,
    });

    return result;
};

export const ProductServices = {
    createProductIntoDB,
    productFromDB,
    updateProductIntoDB,
};
