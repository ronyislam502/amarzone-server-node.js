import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { ShopProductServices } from "./shopProduct.service";

const addProductByShop = catchAsync(async (req, res) => {
  const { email } = req.params;
  const result = await ShopProductServices.addShopProductBySellerFromDB(
    email,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product add by shop Successfully",
    data: result,
  });
});

const AllShopProducts = catchAsync(async (req, res) => {
  const result = await ShopProductServices.AllProductsByShopFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Products by shop retrieved Successfully",
    data: result,
  });
});

const singleProductBySellersFromDB = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ShopProductServices.singleProductBySellersFromDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product by sellers retrieved Successfully",
    data: result,
  });
});

const myShopByProducts = catchAsync(async (req, res) => {
  const { email } = req.params;
  const result = await ShopProductServices.myShopByProductsFromDB(
    email,
    req.query
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My shop products retrieved Successfully",
    meta: result.meta,
    data: result.data,
  });
});

const updateShopProductSellerInfo = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ShopProductServices.updateShopProductSellerInfoFromD(
    req.user,
    id,
    req.body
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "update product by shop Successfully",
    data: result,
  });
});

const productDeleteByShop = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ShopProductServices.deleteProductByShopFromDB(
    req.user,
    id
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "delete product by shop Successfully",
    data: result,
  });
});

export const ShopProductControllers = {
  addProductByShop,
  AllShopProducts,
  singleProductBySellersFromDB,
  myShopByProducts,
  updateShopProductSellerInfo,
  productDeleteByShop,
};
