import httpStatus from "http-status";
import sendResponse from "../../utilities/sendResponse";
import { ProductServices } from "./product.service";
import catchAsync from "./../../utilities/catchAsync";

const createProduct = catchAsync(async (req, res) => {
  const result = await ProductServices.createProductIntoDB(req.user, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Product created successfully",
    data: result,
  });
});

const allProducts = catchAsync(async (req, res) => {
  const result = await ProductServices.AllProductsFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Products retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const offeredProducts = catchAsync(async (req, res) => {
  const result = await ProductServices.offeredProductsFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Offered products retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

const myCreatedProducts = catchAsync(async (req, res) => {
  const { email } = req.params;
  const result = await ProductServices.myCreatedProductsFromDB(
    email,
    req.query
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "my products retrieved successfully",
    meta: result.meta,
    data: result.data,
  });
});

export const ProductControllers = {
  createProduct,
  allProducts,
  offeredProducts,
  myCreatedProducts,
};
