import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Vendor } from "../vendor/vendor.model";
import { TSeller, TShopProduct } from "./shopProduct.interface";
import { Shop } from "../shop/shop.model";
import { Product } from "../product/product.model";
import { calculateDeliveryTime } from "../product/product.utilities";
import { ShopProduct } from "./shopProduct.model";
import QueryBuilder from "../../builder/queryBuilder";
import { JwtPayload } from "jsonwebtoken";

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

const updateProductByShopFromDB = async (
  user: JwtPayload,
  id: string,
  payload: Partial<TSeller>
) => {
  const isVendor = await Vendor.findOne({ email: user?.email });

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

  const isSuspended = isVendorShopped.isSuspended;

  if (isSuspended) {
    throw new AppError(httpStatus.BAD_REQUEST, "Shop is suspended");
  }

  const isProduct = await Product.findById(id);

  if (!isProduct) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  const shopProduct = await ShopProduct.findOne({
    product: isProduct?._id,
    "seller.shop": isVendorShopped._id,
  }).populate("seller.shop");

  const updatedDeliveryTime = calculateDeliveryTime(
    payload?.shippingTime as number
  );

  const updateData = {
    seller: {
      shop: isVendorShopped._id,
      price: payload?.price,
      quantity: payload?.quantity,
      isStock:
        (payload?.quantity as number) > 0 ? (payload?.isStock ?? true) : false,
      shippingTime: payload?.shippingTime,
      deliveryTime: updatedDeliveryTime,
    },
  };

  const result = await ShopProduct.findByIdAndUpdate(
    shopProduct?._id,
    updateData,
    {
      new: true,
      runValidators: true,
    }
  );

  const allSellers = await ShopProduct.find({ product: isProduct._id })
    .populate("seller.shop")
    .populate("seller.shop");

  const availableSellers = allSellers.filter(
    (product) => product.seller.isStock === true && product.seller.quantity > 0
  );

  const lowestPrice = Math.min(
    ...availableSellers.map((product) => product.seller.price)
  );

  const isProductBuyBoxWinner = allSellers
    .map((product) => {
      const isSellerWinner =
        lowestPrice !== null &&
        product.seller.price === lowestPrice &&
        product.seller.isStock &&
        product.seller.quantity > 0;

      if (product.seller.isBuyBoxWinner !== isSellerWinner) {
        return {
          updateOne: {
            filter: { _id: product._id },
            update: { "seller.isBuyBoxWinner": isSellerWinner },
          },
        };
      } else {
        return null;
      }
    })
    .filter((op): op is NonNullable<typeof op> => op !== null);

  if (isProductBuyBoxWinner.length > 0) {
    await ShopProduct.bulkWrite(isProductBuyBoxWinner);
  }

  return result;
};

const deleteProductByShopFromDB = async (user: JwtPayload, id: string) => {
  console.log("user", user);
  const isVendor = await Vendor.findOne({ email: user?.email });

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

  const isSuspended = isVendorShopped.isSuspended;

  if (isSuspended) {
    throw new AppError(httpStatus.BAD_REQUEST, "Shop is suspended");
  }

  const isProduct = await Product.findById(id);

  if (!isProduct) {
    throw new AppError(httpStatus.NOT_FOUND, "Product not found");
  }

  const shopProduct = await ShopProduct.findOne({
    product: isProduct?._id,
    "seller.shop": isVendorShopped._id,
  }).populate("seller.shop");

  const result = await ShopProduct.findByIdAndDelete(shopProduct?._id, {
    new: true,
    runValidators: true,
  });

  return result;
};

export const ShopProductServices = {
  addShopProductBySellerFromDB,
  AllProductsByShopFromDB,
  singleProductBySellersFromDB,
  myShopByProductsFromDB,
  updateProductByShopFromDB,
  deleteProductByShopFromDB,
};
