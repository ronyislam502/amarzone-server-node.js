import httpStatus from "http-status";
import catchAsync from "../../utilities/catchAsync";
import sendResponse from "../../utilities/sendResponse";
import { CustomerServices } from "./customer.service";
import { TImageFile } from "../../interface/image.interface";

const allCustomers = catchAsync(async (req, res) => {
    const result = await CustomerServices.allCustomersFromDB(req.query);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Customers retreived successfully",
        meta: result?.meta,
        data: result?.data
    })

})

const deleteCustomer = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await CustomerServices.deleteCustomerFromDB(id);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Customers deleted successfully",
        data: result
    })
});

const updateCustomer = catchAsync(async (req, res) => {
    const { id } = req.params;
    const result = await CustomerServices.updateCustomerIntoDB(id, req.file as TImageFile, req.body);

    sendResponse(res, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Customer updated successfully",
        data: result,
    });
});

export const CustomerControllers = {
    allCustomers,
    updateCustomer,
    deleteCustomer,
};