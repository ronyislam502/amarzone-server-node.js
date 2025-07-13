import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Vendor } from "../vendor/vendor.model";
import { TShopProduct } from "./shopProduct.interface";
import { Shop } from "../shop/shop.model";
import { Product } from "../product/product.model";
import { calculateDeliveryTime } from "../product/product.utilities";
import { ShopProduct } from "./shopProduct.model";
import QueryBuilder from "../../builder/queryBuilder";

const addShopProductBySellerFromDB = async (
  email: string,
  payload: TShopProduct
) => {
  const isVendor = await Vendor.findOne({ email });

  if (!isVendor) {
    throw new AppError(httpStatus.NOT_FOUND, "Vendor not found");
  }

  const isShopExists = isVendor.isShopped;
  console.log(isShopExists);

  if (!isShopExists) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "this vendor shop not found ! please create your shopped and try again"
    );
  }

  const isVendorShopped = await Shop.findOne({
    vendor: isVendor?._id,
  }).populate("vendor");

  if (!isVendorShopped) {
    throw new AppError(httpStatus.NOT_FOUND, "shop not found ");
  }

  const isShopSuspend = isVendorShopped.isSuspended;

  if (isShopSuspend) {
    throw new AppError(httpStatus.BAD_REQUEST, "you shop is suspended");
  }

  const isProduct = await Product.findOne({ asin: payload?.asin });

  console.log(isProduct);

  if (!isProduct) {
    throw new AppError(httpStatus.NOT_FOUND, "this asin product not found");
  }

  const deliveryTime = calculateDeliveryTime(payload?.seller?.shippingTime);

  const sellerData = {
    product: isProduct._id,
    asin: isProduct.asin,
    seller: {
      shop: isVendorShopped._id,
      price: payload.seller.price,
      quantity: payload.seller.quantity,
      isStock: payload?.seller?.isStock ?? true,
      shippingTime: payload?.seller?.shippingTime,
      deliveryTime: deliveryTime,
    },
  };

  const result = await ShopProduct.create(sellerData);

  return result;
};

const singleProductBySellersFromDB = async (id: string) => {
  const isProduct = await Product.findById(id);
  if (!isProduct) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  const result = await ShopProduct.find({ product: isProduct._id }).populate(
    "seller.shop"
  );

  return result;
};

const AllProductsByShopFromDB = async (query: Record<string, unknown>) => {
  const shopProductsQuery = new QueryBuilder(
    ShopProduct.find()
      .populate("product", "department category title description brand")
      .populate("seller.shop", "shopName"),
    query
  )
    .search(["product.title", "product.description", "price", "asin"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await shopProductsQuery.countTotal();
  const data = await shopProductsQuery.modelQuery;

  return { meta, data };
};

const myShopByProductsFromDB = async (
  email: string,
  query: Record<string, unknown>
) => {
  const isVendor = await Vendor.findOne({ email });

  if (!isVendor) {
    throw new AppError(httpStatus.NOT_FOUND, "Vendor not found");
  }

  const isShopExists = isVendor.isShopped;

  if (!isShopExists) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "this vendor shop not found ! please create your shopped and try again"
    );
  }

  const isVendorShopped = await Shop.findOne({
    vendor: isVendor?._id,
  });

  if (!isVendorShopped) {
    throw new AppError(httpStatus.NOT_FOUND, "shop not found ");
  }

  const shopByProductsQuery = new QueryBuilder(
    ShopProduct.find({ "seller.shop": isVendorShopped._id }),
    query
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await shopByProductsQuery.countTotal();
  const data = await shopByProductsQuery.modelQuery;

  return { meta, data };
};

export const ShopProductServices = {
  addShopProductBySellerFromDB,
  AllProductsByShopFromDB,
  singleProductBySellersFromDB,
  myShopByProductsFromDB,
};
