import AppError from "../../errors/AppError";
import { Department } from "../department/department.model";
import { TProduct } from "./product.interface";
import { Category } from "../category/category.model";
import { Product } from "./product.model";
import { calculateDeliveryTime, generateASIN } from "./product.utiles";
import httpStatus from "http-status";
import QueryBuilder from "../../builder/queryBuilder";
import { JwtPayload } from "jsonwebtoken";
import { Vendor } from "../vendor/vendor.model";
import { USER_ROLE } from "../user/user.const";
import { Shop } from "../shop/shop.model";
import { Admin } from "../admin/admin.model";

const createProductIntoDB = async (user: JwtPayload, payload: TProduct) => {
  console.log("user", user);
  let createdBy: any;
  let sellerEntry: TProduct["sellers"][0] | undefined;

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

    const deliveryTime = await calculateDeliveryTime(
      payload.sellers?.[0]?.shippingTime
    );

    sellerEntry = {
      shop: isShop?._id,
      price: payload?.sellers[0]?.price || 0,
      quantity: payload?.sellers?.[0]?.quantity || 0,
      isStock: payload?.sellers?.[0]?.isStock ?? true,
      shippingTime: payload?.sellers?.[0]?.shippingTime,
      deliveryTime: deliveryTime,
      isBuyBoxWinner: true,
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
    isCreatedByVendor:
      user.role === USER_ROLE.VENDOR || sellerEntry !== undefined,
    isDeleted: false,
    sellers: sellerEntry ? [sellerEntry] : (payload?.sellers ?? []),
  };

  const result = await Product.create(newProduct);

  return result;
};

const AllProductsFromDB = async (query: Record<string, unknown>) => {
  const productQuery = new QueryBuilder(Product.find(), query)
    .search(["title", "department", "category"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await productQuery.countTotal();
  const data = await productQuery.modelQuery;

  return { meta, data };
};

const offeredProductsFromDB = async (query: Record<string, unknown>) => {
  const offeredProductsQuery = new QueryBuilder(Product.find(), query)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await offeredProductsQuery.countTotal();
  const data = await offeredProductsQuery.modelQuery;

  return { meta, data };
};

export const ProductServices = {
  createProductIntoDB,
  AllProductsFromDB,
  offeredProductsFromDB,
};
