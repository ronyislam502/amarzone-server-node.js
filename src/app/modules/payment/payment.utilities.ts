import axios from "axios";
import dotenv from "dotenv";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";
import config from "../../config";
import { TPayment } from "./payment.interface";
import { Customer } from "../customer/customer.model";

dotenv.config();

export const initialPayment = async (paymentData: TPayment) => {
  const userData = await Customer.findById(paymentData?.user);

  try {
    const data = {
      store_id: config.ssl_store_id,
      store_passwd: config.ssl_store_pass,
      total_amount: paymentData.amount,
      currency: "BDT",
      tran_id: paymentData.transactionId,
      success_url: `${config.live_server_url}/api/v1/success`,
      fail_url: `${config.live_server_url}/api/v1/fail`,
      cancel_url: "http://localhost:3030/cancel",
      ipn_url: "http://localhost:3030/ipn",
      shipping_method: "N/A",
      product_name: "Appointment",
      product_category: "Service",
      product_profile: "general",
      cus_name: userData?.name,
      cus_email: userData?.email,
      cus_add1: userData?.address,
      cus_add2: "N/A",
      cus_road: userData?.address?.street,
      cus_house: userData?.address?.house,
      cus_sector: userData?.address?.sector,
      cus_area: userData?.address?.area,
      cus_postcode: userData?.address?.postalCode,
      cus_city: userData?.address?.city,
      cus_state: userData?.address?.state,
      cus_country: userData?.address?.country,
      cus_phone: userData?.phone,
      cus_fax: "N/A",
      ship_name: "N/A",
      ship_add1: userData?.address,
      ship_add2: "N/A",
      ship_city: "N/A",
      ship_state: "N/A",
      ship_postcode: "N/A",
      ship_country: "N/A",
    };

    const response = await axios({
      method: "post",
      url: config.ssl_payment_api,
      data: data,
      headers: { "Content-type": "application/x-www-form-urlencoded" },
    });

    return response?.data?.redirectGatewayURL;
  } catch (error) {
    throw new AppError(httpStatus.BAD_REQUEST, "Payment error occured!");
  }
};

export const validatePayment = async (payload: any) => {
  try {
    const response = await axios({
      method: "GET",
      url: `${config.ssl_validation_api}?val_id=${payload.val_id}&store_id=${config.ssl_store_id}&store_passwd=${config.ssl_store_pass}&format=json`,
    });

    return response.data;
  } catch (error) {
    throw new AppError(httpStatus.BAD_REQUEST, "Payment validate failed");
  }
};
