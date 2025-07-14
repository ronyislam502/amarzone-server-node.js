import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { OrderServices } from "./order.service";

const createOrder = catchAsync(async (req, res) => {
  const result = await OrderServices.createOrderIntoDB(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order created successfully",
    data: result,
  });
});

const allOrders = catchAsync(async (req, res) => {
  const result = await OrderServices.allOrdersFromDB(req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Orders retrieved successfully",
    data: result,
  });
});

const vendorAllOrders = catchAsync(async (req, res) => {
  const { email } = req.params;
  const result = await OrderServices.vendorAllOrdersFromDB(email, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "vendor Orders retrieved successfully",
    data: result,
  });
});

const customerAllOrders = catchAsync(async (req, res) => {
  const { email } = req.params;
  const result = await OrderServices.customerAllOrdersFromDB(email, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "customer Orders retrieved successfully",
    data: result,
  });
});

const singleOrder = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await OrderServices.getSingleOrderFromDB(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Order retrieved successfully",
    data: result,
  });
});

export const OrderControllers = {
  createOrder,
  allOrders,
  vendorAllOrders,
  customerAllOrders,
  singleOrder,
};
