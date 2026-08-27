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


export const InventoryControllers = {
    listProduct
}