import { Worker } from "bullmq";
import { redisConnectionOptions } from "../redis/redis";
import { Order } from "../modules/order/order.model";
import sendEmail from "../utilities/sendEmail";

export const shippingWorker = new Worker(
  "shipping",
  async (job) => {
    const { orderId } = job.data;
    console.log(`[ShippingWorker] Processing shipping confirmation for Order ID: ${orderId}`);

    const orderData = await Order.findById(orderId).populate("customer").populate("tracking.courier");
    if (!orderData) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const customerUser = orderData.customer as unknown as { name?: string; email?: string; _id: string };
    if (!customerUser || !customerUser.email) {
      console.warn(`[ShippingWorker] Customer email not found for Order ID: ${orderId}`);
      return;
    }

    const courierObj = orderData.tracking?.courier as unknown as { name?: string; _id: string };
    const courierName = courierObj && typeof courierObj === "object" ? (courierObj.name || "Courier") : "N/A";
    const trackingNumber = orderData.tracking?.trackingNumber || "N/A";
    
    const shippedAt = orderData.tracking?.shippedAt;
    const shippedAtStr = shippedAt
      ? new Date(shippedAt).toLocaleString()
      : new Date().toLocaleString();
      
    const estimatedDelivery = orderData.tracking?.estimatedDelivery || orderData.deliveryDate?.to;
    const estimatedDeliveryStr = estimatedDelivery
      ? new Date(estimatedDelivery).toLocaleDateString()
      : "N/A";

    const emailHtml = `
      <h2>Your Order has Shipped!</h2>
      <p>Hello ${customerUser.name || "Customer"},</p>
      <p>Good news! Your order <strong>#${orderData.orderNo}</strong> has been shipped and is on its way.</p>
      <p><strong>Shipping Details:</strong></p>
      <ul>
        <li><strong>Courier Name:</strong> ${courierName}</li>
        <li><strong>Tracking Number:</strong> ${trackingNumber}</li>
        <li><strong>Shipping Date:</strong> ${shippedAtStr}</li>
        <li><strong>Estimated Delivery Date:</strong> ${estimatedDeliveryStr}</li>
      </ul>
      <p>Thank you for shopping with us!</p>
    `;

    await sendEmail(
      customerUser.email,
      emailHtml,
      `Shipping Confirmation - Order #${orderData.orderNo}`
    );

    console.log(`[ShippingWorker] Shipping confirmation email sent successfully to ${customerUser.email}`);
  },
  {
    connection: redisConnectionOptions,
  }
);

shippingWorker.on("completed", (job) => {
  console.log(`[ShippingWorker] Job ${job.id} completed successfully.`);
});

shippingWorker.on("failed", (job, err) => {
  console.error(`[ShippingWorker] Job ${job?.id} failed with error: ${err.message}`);
});
