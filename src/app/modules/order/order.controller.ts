import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { OrderServices } from "./order.service";

const createOrder = catchAsync(async (req, res) => {
    const result = await OrderServices.createOrderIntoDB(req.user, req.body);

    sendResponse(res, {
        statusCode: httpStatus.CREATED,
        success: true,
        message: "Order created successfully",
        data: result,
    });
});

const getAllOrders = catchAsync(async (req, res) => {
    const result = await OrderServices.getAllOrdersFromDB(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Orders retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const allOrdersByUser = catchAsync(async (req, res) => {
    const result = await OrderServices.allOrdersByUserFromDB(req.user, req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Customer orders retrieved successfully",
        meta: result.meta,
        data: result.result,
    });
});

const getSingleOrder = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await OrderServices.getSingleOrderFromDB(req.user, id);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Order retrieved successfully",
        data: result,
    });
});

const updateOrder = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await OrderServices.updateOrderInDB(req.user, id, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Order updated successfully",
        data: result,
    });
});

const orderRefund = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await OrderServices.orderRefundFromDB(req.user, id);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Order refunded successfully",
        data: result,
    });
});

export const OrderControllers = {
    createOrder,
    getAllOrders,
    allOrdersByUser,
    getSingleOrder,
    updateOrder,
    orderRefund,
};

