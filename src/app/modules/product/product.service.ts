import { JwtPayload } from "jsonwebtoken";
import { TProduct } from "./product.interface";
import { USER_ROLE } from "../../interface/common";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import { Department } from "../department/department.model";
import { User } from "../user/user.model";
import { Category } from "../category/category.model";
import { recalculateBestSellers } from "../../utilities/calculate";
import { Product } from "./product.model";
import { generateASIN } from "../../utilities/generateAsin";
import { TImageFiles } from "../../interface/image.interface";
import QueryBuilder from "../../builder/queryBuilder";

const createProductIntoDB = async (user: JwtPayload, files: TImageFiles, payload: TProduct) => {
    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const author = {
        role: isUserExists.role,
        id: isUserExists._id,
        name: isUserExists.role === USER_ROLE.VENDOR
            ? isUserExists.name
            : isUserExists.role === USER_ROLE.SUPER_ADMIN
                ? "Super Admin"
                : "Admin",
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
        throw new AppError(httpStatus.BAD_REQUEST, "Selected category does not belong to the selected department.");
    }

    const asin = await generateASIN(isDepartment?.name, isCategory?.name);

    const thumbnail = files?.thumbnail?.[0];
    const images = files?.images;

    if (thumbnail && thumbnail.path) {
        payload.thumbnail = thumbnail.path;
    }

    if (images) {
        payload.images = images?.map((file) => file.path);
    }

    const newProduct: TProduct = {
        ...payload,
        author,
        asin,
        isPrivateLevel: user.role === USER_ROLE.VENDOR || false,
        isDeleted: false,
    };

    const result = await Product.create(newProduct);

    if (result && result.category) {
        await recalculateBestSellers([result.category.toString()]);
    }

    return result;
};

const getSingleProductFromDB = async (id: string) => {
    const product = await Product.findById(id)
        .populate("department")
        .populate("category");

    if (!product || product.isDeleted) {
        throw new AppError(httpStatus.NOT_FOUND, "Product not found");
    }

    return product;
};

const updateProductIntoDB = async (user: JwtPayload, id: string, files: TImageFiles, payload: Partial<TProduct>) => {
    const isProductExists = await Product.findById(id);

    if (!isProductExists || isProductExists.isDeleted) {
        throw new AppError(httpStatus.NOT_FOUND, "Product not found");
    }

    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    if (isUserExists.role === USER_ROLE.VENDOR && isProductExists.author.id?.toString() !== isUserExists._id?.toString()) {
        throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized to update this product");
    }

    const departmentId = payload.department || isProductExists.department;
    const categoryId = payload.category || isProductExists.category;

    const isDepartment = await Department.findById(departmentId);
    if (!isDepartment) {
        throw new AppError(httpStatus.NOT_FOUND, "Department not found");
    }

    const isCategory = await Category.findById(categoryId);
    if (!isCategory) {
        throw new AppError(httpStatus.NOT_FOUND, "Category not found");
    }

    if (isDepartment._id.toString() !== isCategory?.department?.toString()) {
        throw new AppError(httpStatus.BAD_REQUEST, "Selected category does not belong to the selected department.");
    }

    if (payload.department || payload.category) {
        payload.asin = await generateASIN(isDepartment.name, isCategory.name);
    }

    const thumbnail = files?.thumbnail?.[0];
    const images = files?.images;

    if (thumbnail && thumbnail.path) {
        payload.thumbnail = thumbnail.path;
    }

    if (images && images.length > 0) {
        payload.images = images.map((file) => file.path);
    }

    const result = await Product.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    }).populate("department").populate("category");

    if (result && result.category) {
        const categoryIdsToRecalculate = [result.category.toString()];
        if (isProductExists.category && isProductExists.category.toString() !== result.category.toString()) {
            categoryIdsToRecalculate.push(isProductExists.category.toString());
        }
        await recalculateBestSellers(categoryIdsToRecalculate);
    }

    return result;
};

const deleteProductFromDB = async (user: JwtPayload, id: string) => {
    const isProductExists = await Product.findById(id);

    if (!isProductExists || isProductExists.isDeleted) {
        throw new AppError(httpStatus.NOT_FOUND, "Product not found");
    }

    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    if (isUserExists.role === USER_ROLE.VENDOR && isProductExists.author.id?.toString() !== isUserExists._id?.toString()) {
        throw new AppError(httpStatus.UNAUTHORIZED, "You are not authorized to delete this product");
    }

    const deletedProduct = await Product.findByIdAndUpdate(
        id,
        { isDeleted: true },
        { new: true }
    );

    if (isProductExists.category) {
        await recalculateBestSellers([isProductExists.category.toString()]);
    }

    return deletedProduct;
};

const myCreatedProductsFromDB = async (user: JwtPayload, query: Record<string, unknown>) => {
    const isUserExists = await User.isUserExistsByEmail(user.email);

    if (!isUserExists) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const productQuery = new QueryBuilder(
        Product.find({ "author.id": isUserExists._id, isDeleted: false })
            .populate("department")
            .populate("category"),
        query
    )
        .search(["title", "description", "brand", "asin", "tags"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await productQuery.countTotal();
    const data = await productQuery.modelQuery;

    return { meta, data };
};

const allProductsFromDB = async (query: Record<string, unknown>) => {
    const productQuery = new QueryBuilder(
        Product.find({ isDeleted: false })
            .populate("department")
            .populate("category"),
        query
    )
        .search(["title", "description", "brand", "asin", "tags"])
        .filter()
        .sort()
        .paginate()
        .fields();

    const meta = await productQuery.countTotal();
    const data = await productQuery.modelQuery;

    return {
        meta,
        data,
    };
};

export const ProductServices = {
    createProductIntoDB,
    getSingleProductFromDB,
    updateProductIntoDB,
    deleteProductFromDB,
    myCreatedProductsFromDB,
    allProductsFromDB,
};