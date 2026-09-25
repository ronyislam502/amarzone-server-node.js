import mongoose, { Types } from "mongoose";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

import { User } from "../app/modules/user/user.model";
import { Order } from "../app/modules/order/order.model";
import { Dispute } from "../app/modules/dispute/dispute.model";
import { DisputeDecision } from "../app/modules/disputeDecision/disputeDecision.model";
import { DisputeDecisionServices } from "../app/modules/disputeDecision/disputeDecision.service";
import { ConversationServices } from "../app/modules/chat/conversation/conversation.service";
import { Payment } from "../app/modules/payment/payment.model";
import { USER_ROLE } from "../app/interface/common";

const DISPUTE_REASONS = [
  {
    reason: "Damaged item received",
    details: "The packaging was crushed upon delivery and the item inside was visibly damaged and inoperable. Requesting a full refund or immediate replacement.",
    evidenceSuffix: "damaged_item",
  },
  {
    reason: "Defective product on arrival",
    details: "The product powers on but fails immediately during basic operation. Hardware seems internally faulty. Requesting dispute resolution.",
    evidenceSuffix: "defective_product",
  },
  {
    reason: "Incorrect item received",
    details: "The item delivered does not match the specifications or variant selected at checkout. A completely different color/model was shipped.",
    evidenceSuffix: "incorrect_item",
  },
  {
    reason: "Missing parts or accessories",
    details: "The box arrived missing key required parts and cables that were listed in the product description. The product cannot be used without them.",
    evidenceSuffix: "missing_parts",
  },
  {
    reason: "Product significantly not as described",
    details: "The material and dimensions deviate substantially from the seller's catalog images and description. Misleading product specifications.",
    evidenceSuffix: "not_as_described",
  },
  {
    reason: "Signs of prior use or tampering",
    details: "The item box had broken seals and the surface shows scuffs and fingerprints, despite being purchased as brand new. Requesting resolution.",
    evidenceSuffix: "used_item",
  },
];

const REFUND_NOTES = [
  "Dispute evaluated and approved. Verified customer photographic evidence of physical damage upon arrival. Vendor failed to contest within SLA window. Full refund issued.",
  "Dispute approved. Evidence clearly demonstrates wrong model variant was dispatched by vendor. Full refund processed back to original payment method.",
  "Dispute approved. Hardware failure confirmed out of box. Vendor does not offer replacement units for this item; full refund authorized.",
  "Dispute approved. Missing critical components confirmed from unboxing documentation. Merchant uncooperative with replenishment; issuing full buyer refund.",
  "Dispute approved. Item materially departs from platform listing specifications. Full refund issued in accordance with Amarzone Buyer Protection.",
];

const REJECT_NOTES = [
  "Dispute claim rejected. Carrier tracking confirms parcel intact with matching weight and recipient signature. Evidence of alleged defect is insufficient.",
  "Dispute claim rejected. Customer report filed beyond the permitted 14-day defect notification window. Wear and tear appears to be user-induced.",
  "Dispute claim rejected. Vendor demonstrated that the product received matches exact SKU and specs ordered. Discrepancy due to customer misconfiguration.",
  "Dispute claim rejected. Insufficient evidence provided to support non-conformity claim. Item functionality verified against manufacturer specifications.",
];

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not set in .env");
    process.exit(1);
  }

  await mongoose.connect(dbUrl);
  console.log("Connected to MongoDB successfully.");

  // 1. Fetch Admins for resolvedBy attribution
  const admins = await User.find({
    role: { $in: [USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN] },
    isDeleted: { $ne: true },
  });

  if (admins.length === 0) {
    throw new Error("No admin users found to resolve disputes.");
  }
  console.log(`Found ${admins.length} admin accounts for dispute resolution.`);

  // 2. Fetch all Customers
  const customers = await User.find({
    role: USER_ROLE.CUSTOMER,
    isDeleted: { $ne: true },
  }).sort({ createdAt: 1 });

  console.log(`Found ${customers.length} customers in the database.`);

  let totalDisputesCreated = 0;
  let totalDecisionsCreated = 0;
  let totalRefundedCount = 0;
  let totalRejectedCount = 0;
  let totalOpenCount = 0;

  for (let cIdx = 0; cIdx < customers.length; cIdx++) {
    const customer = customers[cIdx];

    // Find delivered orders for this customer that do not already have a dispute
    const existingCustomerDisputes = await Dispute.find({ customer: customer._id });
    const disputedOrderIds = existingCustomerDisputes.map((d) => d.order.toString());

    const deliveredOrders = await Order.find({
      customer: customer._id,
      status: "DELIVERED",
      _id: { $nin: disputedOrderIds },
      isDeleted: { $ne: true },
    }).limit(2);

    if (deliveredOrders.length < 2) {
      console.warn(
        `Customer ${customer.email} has only ${deliveredOrders.length} eligible delivered orders. Skipping or partial.`
      );
      if (deliveredOrders.length === 0) continue;
    }

    const createdCustomerDisputes: any[] = [];

    // Create 2 disputes for this customer
    for (let oIdx = 0; oIdx < deliveredOrders.length; oIdx++) {
      const order = deliveredOrders[oIdx];
      const template = DISPUTE_REASONS[(cIdx * 2 + oIdx) % DISPUTE_REASONS.length];

      const evidenceUrls = [
        `https://res.cloudinary.com/dbljkyof7/image/upload/v1/amarzone/evidence/${template.evidenceSuffix}_${order.orderNo}_1.jpg`,
        `https://res.cloudinary.com/dbljkyof7/image/upload/v1/amarzone/evidence/${template.evidenceSuffix}_${order.orderNo}_2.jpg`,
      ];

      const dispute = await Dispute.create({
        order: order._id,
        customer: customer._id,
        vendor: order.vendor,
        reason: template.reason,
        details: `[Order #${order.orderNo}] ${template.details}`,
        evidenceUrls,
        status: "OPEN",
      });

      // Synchronize DISPUTE chat conversation
      try {
        await ConversationServices.createConversation(customer._id as Types.ObjectId, {
          participants: [customer._id as Types.ObjectId, order.vendor as Types.ObjectId],
          conversationType: "DISPUTE",
          order: order._id as Types.ObjectId,
          dispute: dispute._id as Types.ObjectId,
        });
      } catch (chatError) {
        // Log and continue if conversation already exists
      }

      createdCustomerDisputes.push(dispute);
      totalDisputesCreated++;
    }

    // Now select 1 dispute per customer to create a final decision
    if (createdCustomerDisputes.length > 0) {
      const disputeToResolve = createdCustomerDisputes[0];
      const admin = admins[cIdx % admins.length];

      // 60% Refund, 40% Reject distribution
      // Indices 0, 1, 3 -> REFUNDED (60%); Indices 2, 4 -> REJECTED (40%)
      const isRefund = cIdx % 5 !== 2 && cIdx % 5 !== 4;
      const decisionType = isRefund ? "REFUNDED" : "REJECTED";
      const notes = isRefund
        ? REFUND_NOTES[cIdx % REFUND_NOTES.length]
        : REJECT_NOTES[cIdx % REJECT_NOTES.length];

      const decision = await DisputeDecisionServices.createDecision(
        admin._id as Types.ObjectId,
        {
          dispute: disputeToResolve._id,
          decision: decisionType,
          notes: `[Decision by ${admin.email}] ${notes}`,
        }
      );

      totalDecisionsCreated++;
      if (decisionType === "REFUNDED") {
        totalRefundedCount++;
      } else {
        totalRejectedCount++;
      }
    }

    // The other dispute remains OPEN
    if (createdCustomerDisputes.length > 1) {
      totalOpenCount++;
    }

    if ((cIdx + 1) % 10 === 0 || cIdx === customers.length - 1) {
      console.log(
        `Processed ${cIdx + 1}/${customers.length} customers | Disputes: ${totalDisputesCreated} | Decisions: ${totalDecisionsCreated} (${totalRefundedCount} Refunded, ${totalRejectedCount} Rejected, ${totalOpenCount} Open)`
      );
    }
  }

  console.log("\n================ POPULATION SUMMARY ================");
  console.log(`Total Customers Processed: ${customers.length}`);
  console.log(`Total Disputes Created:    ${totalDisputesCreated}`);
  console.log(`Total Decisions Created:   ${totalDecisionsCreated}`);
  console.log(`  - Refunded Decisions:    ${totalRefundedCount}`);
  console.log(`  - Rejected Decisions:    ${totalRejectedCount}`);
  console.log(`Open Disputes (Pending):   ${totalOpenCount}`);
  console.log("===================================================\n");

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB. Complete!");
}

main().catch((err) => {
  console.error("Error running population script:", err);
  process.exit(1);
});
