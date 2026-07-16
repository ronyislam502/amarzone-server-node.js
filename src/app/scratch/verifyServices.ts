import mongoose from "mongoose";
import { User } from "../modules/user/user.model";
import { Order } from "../modules/order/order.model";
import { DisputeServices } from "../modules/dispute/dispute.service";
import { Dispute } from "../modules/dispute/dispute.model";
import { ChatServices } from "../modules/chat/chat.service";
import { Conversation, Message } from "../modules/chat/chat.model";
import { DisputeDecisionServices } from "../modules/disputeDecision/disputeDecision.service";
import { DisputeDecision } from "../modules/disputeDecision/disputeDecision.model";
import { Payment } from "../modules/payment/payment.model";

const MONGO_URI = "mongodb+srv://amarzon:amarzon123@cluster0.truzii6.mongodb.net/amarzon?appName=Cluster0";

async function runTests() {
  console.log("Connecting to database...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected successfully.");

  // 1. Find or create mock users
  let customer = await User.findOne({ role: "CUSTOMER" });
  if (!customer) {
    customer = await User.create({
      name: "Test Customer",
      email: "testcustomer@test.com",
      password: "password123",
      role: "CUSTOMER",
      status: "ACTIVE",
    });
  }

  let vendor = await User.findOne({ role: "VENDOR" });
  if (!vendor) {
    vendor = await User.create({
      name: "Test Vendor",
      email: "testvendor@test.com",
      password: "password123",
      role: "VENDOR",
      status: "ACTIVE",
    });
  }

  let admin = await User.findOne({ role: "ADMIN" });
  if (!admin) {
    admin = await User.create({
      name: "Test Admin",
      email: "testadmin@test.com",
      password: "password123",
      role: "ADMIN",
      status: "ACTIVE",
    });
  }

  console.log(`Test users: Customer(${customer._id}), Vendor(${vendor._id}), Admin(${admin._id})`);

  // 2. Find or create mock Order
  let order = await Order.findOne();
  if (!order) {
    order = await Order.create({
      customer: customer._id,
      vendor: vendor._id,
      orderNo: "TEST-ORD-101",
      products: [],
      commission: 10,
      tax: 2,
      totalPrice: 100,
      totalQuantity: 1,
      paymentStatus: "PENDING",
      status: "PENDING",
      transactionId: "test_tx_123",
      shippedDate: {
        from: new Date(),
        to: new Date(Date.now() + 86400000 * 2),
      },
      deliveryDate: {
        from: new Date(Date.now() + 86400000 * 3),
        to: new Date(Date.now() + 86400000 * 5),
      },
      shippingAddress: {
        street: "Main St",
        postalCode: "12345",
        state: "CA",
        country: "USA",
      },
      grandAmount: 112,
    });
  }
  console.log(`Test order: ${order._id}`);

  // Create a mock payment for testing refund delegation
  let payment = await Payment.findOne({ orderId: order._id });
  if (!payment) {
    payment = await Payment.create({
      orderId: order._id,
      transactionId: "pi_test_transaction_id",
      amount: 112,
      status: "PAID",
    });
  }

  // 3. Test Dispute Creation
  console.log("\n--- Testing Dispute Creation ---");
  const dispute = await DisputeServices.createDispute(customer._id, {
    order: order._id,
    reason: "Late delivery and damaged item",
    details: "The package was completely destroyed when it arrived, and it was 5 days late.",
    evidenceUrls: ["https://example.com/damages.jpg"],
  });

  console.log(`Dispute raised successfully: ID = ${dispute._id}`);
  console.log(`Status: ${dispute.status}`);

  // Verify Conversation auto-creation
  const conv = await Conversation.findOne({ dispute: dispute._id });
  if (!conv) {
    throw new Error("Dispute conversation was not created automatically!");
  }
  console.log(`Auto-created Conversation: ID = ${conv._id}, Type = ${conv.conversationType}`);
  console.log(`Participants: ${conv.participants.join(", ")}`);

  // 4. Test Chat Send Message
  console.log("\n--- Testing Send Message ---");
  const msg1 = await ChatServices.sendMessage(customer._id, {
    conversation: conv._id,
    message: "Hi, I have opened a dispute about this order. The products were completely smashed.",
    messageType: "TEXT",
  });
  if (!msg1) {
    throw new Error("Failed to send message: msg1 is null");
  }
  console.log(`Message 1 Sent: ID = ${msg1._id}, Status = ${msg1.status}`);

  // 5. Test Unread Count calculation
  console.log("\n--- Testing Get User Conversations (Unread Count check) ---");
  const vendorConversations = await ChatServices.getUserConversations(vendor._id);
  const vendorConv = vendorConversations.find((c: any) => c._id.toString() === conv._id.toString());
  console.log(`Vendor Conversation list size: ${vendorConversations.length}`);
  console.log(`Unread Messages for Vendor: ${vendorConv?.unreadCount}`);
  if (!vendorConv || vendorConv.unreadCount !== 1) {
    throw new Error(`Expected vendor unread count to be 1, got ${vendorConv?.unreadCount}`);
  }

  // 6. Test Mark Messages as Read
  console.log("\n--- Testing Mark Messages as Read ---");
  await ChatServices.markMessagesAsRead(vendor._id, conv._id.toString());
  console.log("Messages marked as read by Vendor.");

  // Check unread count again
  const vendorConversationsAfterRead = await ChatServices.getUserConversations(vendor._id);
  const vendorConvAfter = vendorConversationsAfterRead.find((c: any) => c._id.toString() === conv._id.toString());
  console.log(`Unread Messages for Vendor after mark read: ${vendorConvAfter?.unreadCount}`);
  if (!vendorConvAfter || vendorConvAfter.unreadCount !== 0) {
    throw new Error(`Expected vendor unread count to be 0, got ${vendorConvAfter?.unreadCount}`);
  }

  // 7. Test Dispute Decision and Payment Refund Delegation
  console.log("\n--- Testing Dispute Decision & Payment Refund Delegation ---");
  const decision = await DisputeDecisionServices.createDecision(admin._id, {
    dispute: dispute._id,
    decision: "REFUNDED",
    notes: "Approved refund. The client's package was severely damaged.",
  });

  console.log(`Dispute Decision registered: ID = ${decision._id}, Decision = ${decision.decision}`);

  // Verify Dispute status updated to RESOLVED
  const updatedDispute = await Dispute.findById(dispute._id);
  console.log(`Dispute status updated: ${updatedDispute?.status}`);
  if (updatedDispute?.status !== "RESOLVED") {
    throw new Error(`Expected dispute status to be RESOLVED, got ${updatedDispute?.status}`);
  }

  // Verify Order and Payment statuses were updated by Refund service
  const updatedOrder = await Order.findById(order._id);
  const updatedPayment = await Payment.findById(payment._id);
  console.log(`Order Status: ${updatedOrder?.status}, Payment Status: ${updatedOrder?.paymentStatus}`);
  console.log(`TPayment Status: ${updatedPayment?.status}`);

  if (updatedOrder?.status !== "REFUNDED" || updatedPayment?.status !== "REFUNDED") {
    throw new Error("Refund delegation failed to update Order/Payment statuses!");
  }

  // 8. Test Soft Delete Message
  console.log("\n--- Testing Message Soft Delete ---");
  await ChatServices.deleteMessage(customer._id, msg1._id.toString());
  const deletedMessage = await Message.findById(msg1._id);
  console.log(`Message isDeleted: ${deletedMessage?.isDeleted}`);
  if (deletedMessage?.isDeleted !== true) {
    throw new Error("Message soft deletion failed!");
  }

  // Clean up test data
  console.log("\nCleaning up test database entries...");
  await DisputeDecision.deleteOne({ _id: decision._id });
  await Dispute.deleteOne({ _id: dispute._id });
  await Conversation.deleteOne({ _id: conv._id });
  await Message.deleteMany({ conversation: conv._id });
  await Payment.deleteOne({ _id: payment._id });
  console.log("Cleanup completed.");
}

runTests()
  .then(() => {
    console.log("\n🎉 ALL SERVICES TESTS PASSED SUCCESSFULLY! 🎉");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ TESTS FAILED:", err);
    process.exit(1);
  });
