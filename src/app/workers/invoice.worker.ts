import { Worker } from "bullmq";
import { redisConnectionOptions } from "../redis/redis";
import { Order } from "../modules/order/order.model";
import { Payment } from "../modules/payment/payment.model";
import { cloudinaryUpload } from "../config/cloudinary.config";
import sendEmail from "../utilities/sendEmail";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

// Ensure the temp directory exists
const tempDir = path.join(process.cwd(), "src", "app", "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

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
    const filePath = path.join(tempDir, `invoice_${orderId}.pdf`);

    // 2. Generate PDF Invoice
    console.log(`[InvoiceWorker] Generating PDF Invoice at ${filePath}`);
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    // Design invoice PDF
    // Title & Header
    doc.fontSize(20).text("AMARZONE INVOICE", { align: "center" });
    doc.moveDown();

    // Order Meta info
    doc.fontSize(12).text(`Order Number: #${orderData.orderNo}`);
    doc.text(`Date: ${new Date((orderData as any).createdAt).toLocaleDateString()}`);
    doc.text(`Payment Status: ${orderData.paymentStatus}`);
    doc.text(`Order Status: ${orderData.status}`);
    doc.moveDown();

    // Customer details
    doc.text("Bill To:", { underline: true });
    doc.text(`Name: ${customerUser?.name || "Customer"}`);
    doc.text(`Email: ${customerUser?.email || "N/A"}`);
    doc.moveDown();

    // Products Table
    doc.text("Items purchased:", { underline: true });
    doc.moveDown(0.5);

    orderData.products.forEach((item: any, index: number) => {
      const product = item.product;
      doc.text(
        `${index + 1}. ${product?.name || "Product"} - Qty: ${item.quantity} - Price: $${product?.price || 0}`
      );
    });
    doc.moveDown();

    // Summary
    doc.text(`Total Price: $${orderData.totalPrice}`);
    doc.text(`Tax: $${orderData.tax}`);
    doc.text(`Grand Total: $${orderData.grandAmount}`);

    doc.end();

    // Wait for the file to be completely written
    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", () => resolve());
      writeStream.on("error", (err) => reject(err));
    });

    console.log(`[InvoiceWorker] PDF successfully generated.`);

    // 3. Upload PDF to Cloudinary
    console.log(`[InvoiceWorker] Uploading PDF to Cloudinary...`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Generated PDF file not found at ${filePath}`);
    }

    const uploadResult = await cloudinaryUpload.uploader.upload(filePath, {
      folder: "invoices",
      resource_type: "auto",
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

    // 5. Clean up temporary PDF file
    try {
      await fs.promises.unlink(filePath);
      console.log(`[InvoiceWorker] Temporary local PDF file deleted.`);
    } catch (err: any) {
      console.error(`[InvoiceWorker] Failed to delete temporary PDF file: ${err.message}`);
    }

    // 6. Send Customer confirmation email
    if (customerUser && customerUser.email) {
      console.log(`[InvoiceWorker] Sending confirmation email to Customer: ${customerUser.email}`);
      const customerEmailHtml = `
        <h2>Payment Successful & Order Confirmation</h2>
        <p>Hello ${customerUser.name || "Customer"},</p>
        <p>Your payment for order <strong>#${orderData.orderNo}</strong> was successful!</p>
        <p><strong>Order Details:</strong></p>
        <ul>
          <li>Total Quantity: ${orderData.totalQuantity}</li>
          <li>Total Price: $${orderData.totalPrice}</li>
          <li>Grand Amount (Inc. Tax): $${orderData.grandAmount}</li>
          <li>Est. Shipping Date: ${new Date(orderData.shippedDate.from).toLocaleDateString()} - ${new Date(orderData.shippedDate.to).toLocaleDateString()}</li>
          <li>Est. Delivery Date: ${new Date(orderData.deliveryDate.from).toLocaleDateString()} - ${new Date(orderData.deliveryDate.to).toLocaleDateString()}</li>
        </ul>
        <p>You can view and download your invoice receipt here: <a href="${receiptUrl}">${receiptUrl}</a></p>
        <p>Thank you for shopping with us!</p>
      `;

      await sendEmail(
        customerUser.email,
        customerEmailHtml,
        `Order Payment Successful & Confirmed - #${orderData.orderNo}`
      );
    } else {
      console.warn(`[InvoiceWorker] Skipping Customer email: customer email not found.`);
    }

    // 7. Send Vendor notification email
    if (vendorUser && vendorUser.email) {
      console.log(`[InvoiceWorker] Sending notification email to Vendor: ${vendorUser.email}`);
      const vendorEmailHtml = `
        <h2>New Order Received</h2>
        <p>Hello ${vendorUser.name || "Vendor"},</p>
        <p>You have received a new paid order <strong>#${orderData.orderNo}</strong>.</p>
        <p><strong>Customer Details:</strong></p>
        <ul>
          <li>Name: ${customerUser?.name || "Customer"}</li>
          <li>Email: ${customerUser?.email || "N/A"}</li>
        </ul>
        <p>Please prepare the package for shipment.</p>
      `;

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
