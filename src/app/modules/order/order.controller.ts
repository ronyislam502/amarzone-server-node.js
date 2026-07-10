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

export const OrderControllers = {
    createOrder,
};
