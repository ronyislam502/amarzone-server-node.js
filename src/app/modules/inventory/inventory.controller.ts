import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { InventoryServices } from "./inventory.service";
import { JwtPayload } from "jsonwebtoken";

const listProduct = catchAsync(async (req, res) => {
    const result = await InventoryServices.listProductIntoDB(req.user as JwtPayload, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Product listed in inventory successfully",
        data: result,
    });
});

const myInventory = catchAsync(async (req, res) => {
    const result = await InventoryServices.myInventoryFromDB(
        req.user as JwtPayload,
        req.query
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "My inventory retrieved successfully",
        meta: result.meta,
        data: result.data,
    });
});

const updatePrice = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await InventoryServices.updatePriceIntoDB(
        req.user as JwtPayload,
        id,
        req.body
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Inventory price updated successfully",
        data: result,
    });
});

const updateQuantity = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await InventoryServices.updateQuantityIntoDB(
        req.user as JwtPayload,
        id,
        req.body
    );

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Inventory quantity updated successfully",
        data: result,
    });
});

export const InventoryControllers = {
    listProduct,
    myInventory,
    updatePrice,
    updateQuantity,
}