import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { VendorServices } from "./vendor.service";

const allVendors = catchAsync(async (req, res) => {
    const result = await VendorServices.allVendorsFromDB(req.query);


    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Vendors retrieved successfully",
        meta: result.meta,
        data: result.data
    })
})

const vendor = catchAsync(async (req, res) => {
    const { id } = req.params
    const result = await VendorServices.vendorFromDB(id);


    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Vendor retrieved successfully",
        data: result
    })
})

const deleteVendor = catchAsync(async (req, res) => {
    const { id } = req.params
    const result = await VendorServices.deleteVendorFromDB(id);


    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Vendor deleted successfully",
        data: result
    })
})

export const VendorControllers = {
    allVendors,
    vendor,
    deleteVendor
}