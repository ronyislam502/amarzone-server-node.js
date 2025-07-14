import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { TOrder } from "./order.interface";
import { Product } from "../product/product.model";
import { ShopProduct } from "../shopProduct/shopProduct.model";

const createOrderIntoDB = async (payload: TOrder) => {
  const { customer, shop, products } = payload;

  try {
    const productDetails = [];
    let totalPrice = 0;
    let totalQuantity = 0;

    for (const item of products) {
      const isProduct = await Product.findById(item.product);
      if (!isProduct) {
        throw new AppError(httpStatus.NOT_FOUND, "Product not found");
      }

      const isShopProduct = await ShopProduct.findOne({
        product: isProduct?._id,
        "seller.shop": shop,
        "seller.isBuyBoxWinner": true,
      });

      if (!isShopProduct) {
        throw new AppError(
          httpStatus.NOT_FOUND,
          "this product not found any seller or shop"
        );
      }

      if (item.quantity > isShopProduct?.seller?.quantity) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `${isProduct.title} is out of stock . Available: ${isShopProduct.seller.quantity}`
        );
      }

      productDetails.push({
        product: isProduct._id,
        quantity: item.quantity,
      });

      totalPrice += parseFloat(
        (isShopProduct.seller.price * item.quantity).toFixed(2)
      );
      totalQuantity += item.quantity;

      // console.log(totalPrice, totalQuantity);

      const updatedQuantity = isShopProduct?.seller?.quantity - item.quantity;
      const isStock = updatedQuantity > 0;

      console.log("isStock", isStock);

      // Update ShopProduct stock and quantity
      await ShopProduct.findByIdAndUpdate(
        isShopProduct._id,
        {
          $set: {
            "seller.quantity": updatedQuantity,
            isStock: isStock,
          },
        },
        { new: true, runValidators: true }
      );

      await isShopProduct.save();
    }

    const tax = parseFloat((totalPrice * 0.1).toFixed(2));
    const grandAmount = totalPrice + tax;

    // const orderNo = ;

    const today = new Date();
    const transactionId =
      "A2Z" +
      today.getFullYear() +
      +today.getMonth() +
      +today.getDay() +
      +today.getHours() +
      +today.getMinutes() +
      +today.getSeconds();
  } catch (error: any) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Order creation failed: ${error?.message}`
    );
  }
};

export const OrderServices = { createOrderIntoDB };
