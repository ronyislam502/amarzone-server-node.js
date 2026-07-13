import { Worker } from "bullmq";
import { redisConnectionOptions } from "../redis/redis";
import { Order } from "../modules/order/order.model";
import { Payment } from "../modules/payment/payment.model";
import { cloudinaryUpload } from "../config/cloudinary.config";
import sendEmail from "../utilities/sendEmail";
import {
  generateInvoiceData,
  generateCustomerEmailHtml,
  generateVendorEmailHtml,
} from "./invoice.template";
import { generateInvoicePdf } from "./invoice.pdf";

export const invoiceWorker = new Worker(
  "invoice",
  async (job) => {
    const { orderId } = job.data;
    console.log(`[InvoiceWorker] Started processing post-payment workflow for Order ID: ${orderId}`);

    // 1. Fetch Order and related documents
    const orderData = await Order.findById(orderId)
      .populate("customer")
      .populate("vendor")
      .populate("products.product");

    if (!orderData) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const customerUser = orderData.customer as any;
    const vendorUser = orderData.vendor as any;

    // 2. Generate PDF Invoice in Memory using helper modules
    console.log(`[InvoiceWorker] Formatting invoice data...`);
    const invoiceData = generateInvoiceData(orderData);

    console.log(`[InvoiceWorker] Generating PDF Invoice in memory for Order ID: ${orderId}`);
    const pdfBuffer = await generateInvoicePdf(invoiceData);
    console.log(`[InvoiceWorker] PDF successfully generated in memory.`);

    // 3. Upload PDF Buffer to Cloudinary using upload_stream
    console.log(`[InvoiceWorker] Uploading PDF to Cloudinary using upload_stream...`);
    const uploadResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinaryUpload.uploader.upload_stream(
        {
          folder: "invoices",
          resource_type: "auto",
        },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          resolve(result);
        }
      );
      uploadStream.end(pdfBuffer);
    });

    const receiptUrl = uploadResult.secure_url;
    console.log(`[InvoiceWorker] PDF uploaded. URL: ${receiptUrl}`);

    // 4. Update the Payment document
    const payment = await Payment.findOneAndUpdate(
      { orderId },
      { $set: { receiptUrl } },
      { new: true }
    );

    if (!payment) {
      console.warn(`[InvoiceWorker] Payment document not found to update for Order ID: ${orderId}`);
    } else {
      console.log(`[InvoiceWorker] Updated Payment record with receipt URL.`);
    }

    // 5. Send Customer confirmation email
    if (customerUser && customerUser.email) {
      console.log(`[InvoiceWorker] Sending confirmation email to Customer: ${customerUser.email}`);
      const customerEmailHtml = generateCustomerEmailHtml(orderData, customerUser, receiptUrl);

      await sendEmail(
        customerUser.email,
        customerEmailHtml,
        `Order Payment Successful & Confirmed - #${orderData.orderNo}`
      );
    } else {
      console.warn(`[InvoiceWorker] Skipping Customer email: customer email not found.`);
    }

    // 6. Send Vendor notification email
    if (vendorUser && vendorUser.email) {
      console.log(`[InvoiceWorker] Sending notification email to Vendor: ${vendorUser.email}`);
      const vendorEmailHtml = generateVendorEmailHtml(orderData, vendorUser, customerUser);

      await sendEmail(
        vendorUser.email,
        vendorEmailHtml,
        `New Order Booking Notification - #${orderData.orderNo}`
      );
    } else {
      console.warn(`[InvoiceWorker] Skipping Vendor email: vendor email not found.`);
    }

    console.log(`[InvoiceWorker] Finished background workflow for Order ID: ${orderId}`);
  },
  {
    connection: redisConnectionOptions,
  }
);

invoiceWorker.on("completed", (job) => {
  console.log(`[InvoiceWorker] Job ${job.id} completed successfully.`);
});

invoiceWorker.on("failed", (job, err) => {
  console.error(`[InvoiceWorker] Job ${job?.id} failed with error: ${err.message}`);
});
