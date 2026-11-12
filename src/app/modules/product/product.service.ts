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
import QueryBuilder from "../../builder/queryBuilder";
import { Variant } from "../variant/variant.model";
import { Inventory } from "../inventory/inventory.model";
import { ProductReview } from "../productReview/productReview.model";
import { Types } from "mongoose";
import { getSuspendedVendorIds } from "../../utilities/buyBox";

const createProductIntoDB = async (
    user: JwtPayload,
    image: TImageFile,
    payload: TProduct
) => {
    const isUserExists = await User.isUserExistsByEmail(user?.email);

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

    const prodData = {
        author,
        department: isDepartment._id,
        category: isCategory._id,
        title: payload.title,
        features: payload.features,
        thumbnail: payload.thumbnail,
        brand: payload.brand,
        tags: payload.tags
    }


    const result = await Product.create(prodData);

    return result;
};



const allProductsFromDB = async (query: Record<string, unknown>) => {
    const productsQuery = new QueryBuilder(
        Product.find({ isDeleted: { $ne: true } })
            .populate("department")
            .populate("category"),
        query
    )
        .search(["title", "brand", "department", "category", "tags"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await productsQuery.countTotal();
    const data = await productsQuery.modelQuery;

    return { meta, data }
};

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

    const updProd = {

    }

    const result = await Product.findByIdAndUpdate(isProductExists._id, payload, {
        new: true,
        runValidators: true,
    });

    return result;
};



const singleProductFromDB = async (id: string) => {
    const result = await Product.findById(id)
        .populate("department")
        .populate("category");

    if (!result) {
        throw new AppError(httpStatus.NOT_FOUND, "This product not found");
    }

    return result;
};


export const ProductServices = {
    createProductIntoDB,
    allProductsFromDB,
    updateProductIntoDB,
    singleProductFromDB
};

