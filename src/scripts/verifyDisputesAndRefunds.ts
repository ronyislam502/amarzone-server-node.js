import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import { Dispute } from "../app/modules/dispute/dispute.model";
import { DisputeDecision } from "../app/modules/disputeDecision/disputeDecision.model";
import { Order } from "../app/modules/order/order.model";
import { Payment } from "../app/modules/payment/payment.model";
import { User } from "../app/modules/user/user.model";
import { USER_ROLE, ORDER_STATUS, PAYMENT_STATUS } from "../app/interface/common";

async function verify() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not set in .env");
    process.exit(1);
  }

  await mongoose.connect(dbUrl);
  console.log("Connected to MongoDB for verification.\n");

  const totalCustomers = await User.countDocuments({ role: USER_ROLE.CUSTOMER, isDeleted: { $ne: true } });
  const totalDisputes = await Dispute.countDocuments();
  const openDisputes = await Dispute.countDocuments({ status: "OPEN" });
  const resolvedDisputes = await Dispute.countDocuments({ status: "RESOLVED" });
  const rejectedDisputes = await Dispute.countDocuments({ status: "REJECTED" });

  const totalDecisions = await DisputeDecision.countDocuments();
  const refundedDecisions = await DisputeDecision.countDocuments({ decision: "REFUNDED" });
  const rejectedDecisions = await DisputeDecision.countDocuments({ decision: "REJECTED" });

  const refundedOrders = await Order.countDocuments({
    status: ORDER_STATUS.REFUNDED,
    paymentStatus: PAYMENT_STATUS.REFUNDED,
  });

  const refundedPayments = await Payment.countDocuments({
    status: PAYMENT_STATUS.REFUNDED,
  });

  console.log("=================== VERIFICATION RESULTS ===================");
  console.log(`Total Customers:              ${totalCustomers}`);
  console.log(`Total Disputes in DB:         ${totalDisputes}`);
  console.log(`  - OPEN Disputes:            ${openDisputes}`);
  console.log(`  - RESOLVED (Refunded):      ${resolvedDisputes}`);
  console.log(`  - REJECTED:                 ${rejectedDisputes}`);
  console.log(`------------------------------------------------------------`);
  console.log(`Total Decisions in DB:        ${totalDecisions}`);
  console.log(`  - REFUNDED Decisions:       ${refundedDecisions}`);
  console.log(`  - REJECTED Decisions:       ${rejectedDecisions}`);
  console.log(`------------------------------------------------------------`);
  console.log(`Total Refunded Orders:        ${refundedOrders}`);
  console.log(`Total Refunded Payments:      ${refundedPayments}`);
  console.log("============================================================\n");

  // Sample check 1: Verify a customer's disputes
  const sampleCustomer = await User.findOne({ role: USER_ROLE.CUSTOMER, isDeleted: { $ne: true } });
  if (sampleCustomer) {
    console.log(`--- Sample Customer: ${sampleCustomer.name} (${sampleCustomer.email}) ---`);
    const customerDisputes = await Dispute.find({ customer: sampleCustomer._id }).populate("order");
    console.log(`Disputes for this customer (${customerDisputes.length}):`);
    for (const d of customerDisputes) {
      const decision = await DisputeDecision.findOne({ dispute: d._id });
      const order = d.order as any;
      console.log({
        disputeId: d._id,
        orderNo: order?.orderNo,
        orderStatus: order?.status,
        orderPaymentStatus: order?.paymentStatus,
        reason: d.reason,
        disputeStatus: d.status,
        decision: decision ? decision.decision : "None (Still OPEN)",
        resolvedBy: d.resolvedBy,
      });
    }
  }

  // Sample check 2: Verify a Refunded Order and Payment details
  const sampleRefundDecision = await DisputeDecision.findOne({ decision: "REFUNDED" }).populate({
    path: "dispute",
    populate: { path: "order" },
  });

  if (sampleRefundDecision) {
    const dispute = sampleRefundDecision.dispute as any;
    const order = dispute.order as any;
    const payment = await Payment.findOne({
      $or: [{ orderId: order._id }, { transactionId: order.transactionId }],
    });

    console.log("\n--- Sample Refunded Order & Payment Audit Trail ---");
    console.log("Decision:", {
      decisionId: sampleRefundDecision._id,
      decision: sampleRefundDecision.decision,
      notes: sampleRefundDecision.notes,
      resolvedBy: sampleRefundDecision.resolvedBy,
    });
    console.log("Dispute:", {
      disputeId: dispute._id,
      status: dispute.status,
      reason: dispute.reason,
    });
    console.log("Order:", {
      orderId: order._id,
      orderNo: order.orderNo,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalPrice: order.totalPrice,
    });
    console.log("Payment Record:", {
      paymentId: payment?._id,
      status: payment?.status,
      transactionId: payment?.transactionId,
      amount: payment?.amount,
      refundGatewayData: payment?.paymentGatewayData,
    });
  }

  await mongoose.disconnect();
}

verify().catch((err) => {
  console.error("Verification error:", err);
  process.exit(1);
});
