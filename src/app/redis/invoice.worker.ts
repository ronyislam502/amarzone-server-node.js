import { Worker, Job } from "bullmq";
import { redisConnectionOptions } from "./redis";
import { Order } from "../modules/order/order.model";
import { Customer } from "../modules/customer/customer.model";
import {
  generateInvoicePdf,
  mapOrderToInvoiceData,
  uploadPdfToCloudinary,
} from "../utilities/generatePdf";
import sendEmail from "../utilities/sendEmail";

export const invoiceWorker = new Worker(
  "invoice",
  async (job: Job<{ orderId: string }>) => {
    const { orderId } = job.data;
    console.log(`[Invoice Worker] Processing invoice generation for order: ${orderId}`);

    const order = await Order.findById(orderId)
      .populate("customer", "name email")
      .populate("vendor", "name email")
      .populate({
        path: "products.variant",
        populate: {
          path: "product",
          select: "title thumbnail",
        },
      });

    if (!order) {
      console.error(`[Invoice Worker] Order not found: ${orderId}`);
      return;
    }

    const customerId = (order.customer as any)?._id || order.customer;
    const customerProfile = await Customer.findOne({ user: customerId });

    const invoiceData = mapOrderToInvoiceData(order, customerProfile);
    const pdfBuffer = await generateInvoicePdf(invoiceData);

    // 1. Upload PDF to Cloudinary
    let invoiceUrl = "";
    try {
      const uploadResult = await uploadPdfToCloudinary(pdfBuffer, invoiceData.invoiceNo);
      invoiceUrl = uploadResult.secure_url;
      console.log(`[Invoice Worker] PDF uploaded to Cloudinary: ${invoiceUrl}`);

      // 2. Persist invoiceUrl to Order in DB
      await Order.findByIdAndUpdate(orderId, { invoiceUrl });
    } catch (uploadErr) {
      console.error("[Invoice Worker] Cloudinary upload failed:", uploadErr);
    }

    // 3. Email customer with Cloudinary invoice link
    const recipientEmail = customerProfile?.email || (order.customer as any)?.email;
    if (recipientEmail) {
      try {
        await sendEmail(
          recipientEmail,
          `<div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
            <h2 style="color: #111827;">Thank you for shopping with <span style="color: #dfa841;">Amarzone!</span></h2>
            <p>Dear ${customerProfile?.name || "Customer"},</p>
            <p>Your payment has been received and your order is being processed.</p>
            <p><strong>Order ID:</strong> ${invoiceData.orderId}<br/>
               <strong>Invoice No:</strong> #${invoiceData.invoiceNo}<br/>
               <strong>Grand Total:</strong> ৳ ${invoiceData.grandTotal.toLocaleString("en-US")}</p>
            ${
              invoiceUrl
                ? `<div style="margin: 25px 0;">
                    <a href="${invoiceUrl}" target="_blank" style="background-color: #090b0e; color: #dfa841; padding: 12px 22px; text-decoration: none; border-radius: 6px; font-weight: bold; border: 1px solid #dfa841; display: inline-block;">
                      View & Download PDF Invoice
                    </a>
                   </div>`
                : ""
            }
            <p style="color: #6b7280; font-size: 12px; margin-top: 25px;">Shop More, Pay Less &mdash; Amarzone Ltd.</p>
          </div>`,
          `Your Amarzone Order Invoice - #${invoiceData.invoiceNo}`
        );
        console.log(`[Invoice Worker] Confirmation email sent to ${recipientEmail}`);
      } catch (emailErr) {
        console.warn(`[Invoice Worker] Could not send email:`, emailErr);
      }
    }

    return { invoiceNo: invoiceData.invoiceNo, invoiceUrl };
  },
  {
    connection: redisConnectionOptions,
    concurrency: 2,
  }
);

invoiceWorker.on("completed", (job) => {
  console.log(`[Invoice Worker] Job ${job.id} completed successfully.`);
});

invoiceWorker.on("failed", (job, err) => {
  console.error(`[Invoice Worker] Job ${job?.id} failed with error:`, err);
});
