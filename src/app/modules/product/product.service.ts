import AppError from "../../errors/AppError";
import { Department } from "../department/department.model";
import { TProduct } from "./product.interface";
import { Category } from "../category/category.model";
import { Product } from "./product.model";
import httpStatus from "http-status";
import QueryBuilder from "../../builder/queryBuilder";
import { JwtPayload } from "jsonwebtoken";
import { Vendor } from "../vendor/vendor.model";
import { USER_ROLE } from "../user/user.const";
import { Shop } from "../shop/shop.model";
import { Admin } from "../admin/admin.model";
import { generateASIN } from "./product.utilities";

const createProductIntoDB = async (user: JwtPayload, payload: TProduct) => {
  let createdBy: any;

  if (user?.role === USER_ROLE.ADMIN) {
    const isAdmin = await Admin.findOne({ email: user?.email });

    if (!isAdmin) {
      throw new AppError(httpStatus.NOT_FOUND, "Admin not found");
    }
    createdBy = {
      role: USER_ROLE.ADMIN,
      id: isAdmin._id,
      name: "admin",
    };
  } else if (user.role === USER_ROLE.VENDOR) {
    const isVendor = await Vendor.findOne({ email: user?.email });

    if (!isVendor) {
      throw new AppError(httpStatus.NOT_FOUND, "Vendor not found");
    }

    const isCreatedProduct = isVendor.isCreateProduct;

    if (!isCreatedProduct) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You cannot create products, please get permission from the admin."
      );
    }

    const isShop = await Shop.findOne({ vendor: isVendor?._id });
    if (!isShop) {
      throw new AppError(httpStatus.NOT_FOUND, "Shop not found");
    }

    createdBy = {
      role: USER_ROLE.VENDOR,
      id: isVendor?._id,
      name: isShop?.shopName,
    };
  } else {
    throw new Error("Unauthorized role");
  }

  const isDepartment = await Department.findById(payload?.department);

  if (!isDepartment) {
    throw new AppError(httpStatus.NOT_FOUND, "Department not found");
  }

  const isCategory = await Category.findById(payload?.category);

  if (!isCategory) {
    throw new AppError(httpStatus.NOT_FOUND, "Department not found");
  }

  if (isDepartment._id === isCategory?.department) {
    throw new AppError(httpStatus.BAD_REQUEST, "department do not match");
  }

  payload.asin = await generateASIN(isDepartment?.name, isCategory?.title);

  const newProduct: TProduct = {
    ...payload,
    createdBy,
    isCreatedByVendor: user.role === USER_ROLE.VENDOR || false,
    isDeleted: false,
  };

  const result = await Product.create(newProduct);

  return result;
};

const offeredProductsFromDB = async (query: Record<string, unknown>) => {
  const offeredProductsQuery = new QueryBuilder(
    Product.find({ "createdBy.role": "ADMIN" }),
    query
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await offeredProductsQuery.countTotal();
  const data = await offeredProductsQuery.modelQuery;

  return { meta, data };
};

const myCreatedProductsFromDB = async (
  email: string,
  query: Record<string, unknown>
) => {
  // console.log();
  const isVendor = await Vendor.findOne({ email });
  const isAdmin = await Admin.findOne({ email });

  let user;

  if (isVendor) {
    user = { _id: isVendor._id, role: USER_ROLE.VENDOR, isCreateProduct: true };
  } else if (isAdmin) {
    user = { _id: isAdmin._id, role: USER_ROLE.ADMIN };
  } else {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const myCreatedProductsQuery = new QueryBuilder(
    Product.find({
      "createdBy.id": user._id,
      "createdBy.role": user.role,
    }),
    query
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await myCreatedProductsQuery.countTotal();
  const data = await myCreatedProductsQuery.modelQuery;

  return { meta, data };
};

export const ProductServices = {
  createProductIntoDB,
  offeredProductsFromDB,
  myCreatedProductsFromDB,
};
