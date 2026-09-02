import { Server, Socket } from "socket.io";
import httpStatus from "http-status";
import { UserServices } from "../modules/user/user.service";
import { sendSocketResponse } from "./socketResponse";


export const userSocket = (io: Server, socket: Socket) => {
  // ==========================================
  // CREATE ADMIN
  // ==========================================

  socket.on("createAdmin", async (data, callback) => {
    try {
      const { image, password, admin } = data;

      const result = await UserServices.createAdminIntoDB(
        image,
        password,
        admin
      );

      sendSocketResponse(callback, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Admin created successfully",
        data: result,
      });
    } catch (error: any) {
      sendSocketResponse(callback, {
        statusCode: error?.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: error?.message,
        data: null,
      });
    }
  });

  // ==========================================
  // CREATE VENDOR
  // ==========================================

  socket.on("createVendor", async (data, callback) => {
    try {
      const { images, password, vendor } = data;

      const result = await UserServices.createVendorIntoDB(
        images,
        password,
        vendor
      );

      sendSocketResponse(callback, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Vendor created successfully",
        data: result,
      });
    } catch (error: any) {
      sendSocketResponse(callback, {
        statusCode: error?.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: error?.message,
        data: null,
      });
    }
  });

  // ==========================================
  // CREATE CUSTOMER
  // ==========================================

  socket.on("createCustomer", async (data, callback) => {
    try {
      const { image, password, customer } = data;

      const result = await UserServices.createCustomerIntoDB(
        image,
        password,
        customer
      );

      sendSocketResponse(callback, {
        statusCode: httpStatus.OK,
        success: true,
        message: "Customer created successfully",
        data: result,
      });
    } catch (error: any) {
      sendSocketResponse(callback, {
        statusCode: error?.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: error?.message,
        data: null,
      });
    }
  });
};