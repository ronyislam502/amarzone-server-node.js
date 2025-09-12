import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { ShopServices } from "./shop.service";

const createShop = catchAsync(async (req, res) => {
  const result = await ShopServices.createShopIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shop created successfully",
    data: result,
  });
});

const allShops = catchAsync(async (req, res) => {
  const result = await ShopServices.allShopsFromDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Shops retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const singleShop = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await ShopServices.myShopFromDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: " Shop retrieved successfully",
    data: result,
  });
});

const myShop = catchAsync(async (req, res) => {
  const { email } = req.params;
  const result = await ShopServices.myShopFromDB(email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "My Shop retrieved successfully",
    data: result,
  });
});

export const ShopControllers = {
  createShop,
  allShops,
  myShop,
  singleShop,
};
