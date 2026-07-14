import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { OrderServices } from "./order.service";

const createOrder = catchAsync(async (req, res) => {
    const result = await OrderServices.createOrderIntoDB(req.user, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Order placed successfully",
        data: result,
    });
});

const allOrders = catchAsync(async (req, res) => {
    const result = await OrderServices.allOrdersFromDB(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "All orders retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const allOrdersByVendor = catchAsync(async (req, res) => {
    const result = await OrderServices.allOrdersByVendorFromDB(req.user, req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Vendor orders retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const allOrdersByCustomer = catchAsync(async (req, res) => {
    const result = await OrderServices.allOrdersByCustomerFromDB(req.user, req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Customer orders retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const updateOrderTracking = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await OrderServices.updateOrderTrackingIntoDB(req.user, id, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Order tracking updated successfully",
        data: result,
    });
});

const updateOrderShipping = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await OrderServices.updateOrderShippingIntoDB(req.user, id, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Order shipping details updated successfully",
        data: result,
    });
});

export const OrderControllers = {
    createOrder,
    allOrders,
    allOrdersByVendor,
    allOrdersByCustomer,
    updateOrderTracking,
    updateOrderShipping,
};
