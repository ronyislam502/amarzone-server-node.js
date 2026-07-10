import httpStatus from "http-status"
import catchAsync from "../../utilities/catchAsync"
import sendResponse from "../../utilities/sendResponse"
import { InventoryServices } from "./inventory.service"

const listProduct = catchAsync(async (req, res) => {
    const result = await InventoryServices.listProductIntoDB(req.user, req.body)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "product created successfully",
        data: result
    })
})

const inventoryProducts = catchAsync(async (req, res) => {
    const result = await InventoryServices.allInventoryProductsFromDB(req.query)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "inventory products retrieved successfully",
        data: result
    })
})

const updatePrice = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await InventoryServices.updatePriceIntoDB(req.user, id, req.body)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "price updated successfully",
        data: result
    })
})

const updateQuantity = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await InventoryServices.updateQuantityIntoDB(req.user, id, req.body)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "quantity updated successfully",
        data: result
    })
})


const inventoryProductsByVendor = catchAsync(async (req, res) => {
    const result = await InventoryServices.inventoryProductsByVendorFromDB(req.user, req.query)

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "inventory products by vendor retrieved successfully",
        data: result
    })
})

export const InventoryControllers = {
    listProduct,
    updatePrice,
    updateQuantity,
    inventoryProductsByVendor
}