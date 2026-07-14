import mongoose from "mongoose";
import config from "../config";
import { User } from "../modules/user/user.model";
import { Product } from "../modules/product/product.model";
import { Order } from "../modules/order/order.model";
import { InventoryProduct } from "../modules/inventory/inventory.model";
import { ServiceReview } from "../modules/review/review.model";
import { AccountHealth } from "../modules/health/health.model";
import { AccountHealthServices } from "../modules/health/health.service";
import { InventoryServices } from "../modules/inventory/inventory.service";

async function runTest() {
  console.log("Connecting to Database...");
  await mongoose.connect(config.database_url as string);
  console.log("Connected to MongoDB.");

  // Create mock vendor and customer
  const vendor = await User.create({
    name: "BuyBox Mgt Vendor",
    email: `vendor.bbmgt.${Date.now()}@example.com`,
    password: "password123",
    role: "VENDOR",
    status: "ACTIVE",
  });
  const customer = await User.create({
    name: "BuyBox Mgt Customer",
    email: `customer.bbmgt.${Date.now()}@example.com`,
    password: "password123",
    role: "CUSTOMER",
    status: "ACTIVE",
  });

  const vendorJwt = { email: vendor.email, role: "VENDOR" };

  // Create mock Product
  const product = await Product.create({
    author: {
      role: "VENDOR",
      id: vendor._id,
      name: vendor.name,
    },
    title: "BuyBox Mgt Product",
    description: "Product description",
    asin: `ASIN-MGT-${Date.now()}`,
    thumbnail: "thumb.jpg",
    brand: "Test Brand",
    isPrivateLevel: false,
    isDeleted: false,
    tags: [],
    variants: [],
    features: [],
    department: new mongoose.Types.ObjectId(),
    category: new mongoose.Types.ObjectId(),
  });

  // Create 4 mock inventory products for the vendor (initial isBuyBoxWinner should be false)
  const invs = [];
  for (let i = 0; i < 4; i++) {
    invs.push(
      await InventoryProduct.create({
        product: product._id,
        asin: product.asin,
        seller: {
          vendor: vendor._id,
          price: 10 + i * 5,
          quantity: 10,
          isStock: true,
          fulfillmentBy: "Merchant",
          shippingTime: 3,
          isBuyBoxWinner: false,
        },
      })
    );
  }

  console.log(`Mock vendor: ${vendor._id}, customer: ${customer._id}, product: ${product._id}`);
  console.log(`Created ${invs.length} inventory products.`);

  // Test 1: First-time vendor (no sales - should be ineligible)
  console.log("\n--- Test 1: First-time vendor calculation (expect ineligible) ---");
  await AccountHealthServices.calculateVendorHealth(vendor._id.toString());
  
  let currentInvs = await InventoryProduct.find({ "seller.vendor": vendor._id });
  let winners = currentInvs.filter(i => i.seller.isBuyBoxWinner === true);
  console.log("Active winners count:", winners.length);
  if (winners.length === 0) {
    console.log("✅ SUCCESS: First-time vendor has 0 Buy Box winners.");
  } else {
    console.error("❌ FAILURE: First-time vendor has winners.");
  }

  // Test 2: Build sales history (create 20 completed orders with valid tracking to trigger eligibility)
  console.log("\n--- Test 2: Building sales history to 20 completed orders ---");
  const courierId = new mongoose.Types.ObjectId();
  const orders = [];
  for (let i = 0; i < 20; i++) {
    orders.push(
      await Order.create({
        customer: customer._id,
        vendor: vendor._id,
        orderNo: `ORD-BB-${i}-${Date.now()}`,
        products: [],
        commission: 15,
        tax: 10,
        totalPrice: 100,
        totalQuantity: 1,
        grandAmount: 110,
        shippedDate: { from: new Date(), to: new Date() },
        deliveryDate: { from: new Date(), to: new Date() },
        status: "DELIVERED",
        paymentStatus: "PAID",
        transactionId: `TX-BB-${i}-${Date.now()}`,
        tracking: {
          courier: courierId,
          trackingNumber: `TRK-BB-${i}`,
          shippedBy: vendor._id,
          shippedAt: new Date(),
        }
      })
    );
  }
  console.log(`Created ${orders.length} completed orders.`);

  // Trigger recalculation (which recalculates health score to 1000, evaluates SLA, and triggers Buy Box)
  await AccountHealthServices.calculateVendorHealth(vendor._id.toString());

  currentInvs = await InventoryProduct.find({ "seller.vendor": vendor._id });
  winners = currentInvs.filter(i => i.seller.isBuyBoxWinner === true);
  console.log("Winners count after eligibility:", winners.length);
  
  // Configured percentage: 25% of 4 products is 1. Expect exactly 1 winner.
  if (winners.length === 1) {
    console.log("✅ SUCCESS: Assigned Buy Box to exactly 1 product (25% of inventory).");
  } else {
    console.error(`❌ FAILURE: Expected 1 winner, got ${winners.length}`);
  }

  // Test 3: Price Update (should recalculate Buy Box and trigger socket event)
  console.log("\n--- Test 3: Price update check ---");
  const initialWinner = winners[0];
  await InventoryServices.updatePriceIntoDB(vendorJwt as any, initialWinner._id.toString(), { price: 99 });
  
  currentInvs = await InventoryProduct.find({ "seller.vendor": vendor._id });
  winners = currentInvs.filter(i => i.seller.isBuyBoxWinner === true);
  console.log("Winners count after price update:", winners.length);
  if (winners.length === 1) {
    console.log("✅ SUCCESS: Buy Box recalculated and exactly 1 winner exists after price update.");
  } else {
    console.error("❌ FAILURE: Incorrect winner count after price update:", winners.length);
  }

  // Test 4: Stock update to 0 / Out of Stock (winner product loses Buy Box, another in-stock product receives it)
  console.log("\n--- Test 4: Quantity update to 0 (winner loses, new winner assigned) ---");
  const currentWinner = winners[0];
  await InventoryServices.updateQuantityIntoDB(vendorJwt as any, currentWinner._id.toString(), { quantity: 0 });

  currentInvs = await InventoryProduct.find({ "seller.vendor": vendor._id });
  winners = currentInvs.filter(i => i.seller.isBuyBoxWinner === true);
  const updatedOldWinner = currentInvs.find(i => i._id.toString() === currentWinner._id.toString());
  
  console.log("Old winner isBuyBoxWinner:", updatedOldWinner?.seller.isBuyBoxWinner);
  console.log("Total winners count after stockout:", winners.length);

  if (updatedOldWinner?.seller.isBuyBoxWinner === false && winners.length === 1) {
    console.log("✅ SUCCESS: Out of stock winner lost Buy Box, and 1 of the remaining in-stock products won it.");
  } else {
    console.error("❌ FAILURE: Winner did not shift correctly after stockout.");
  }

  // Test 5: Losing Buy Box (poor rating)
  console.log("\n--- Test 5: Submitting poor rating (should trigger losing Buy Box) ---");
  const srvReview = await ServiceReview.create({
    customer: customer._id,
    vendor: vendor._id,
    order: orders[0]._id,
    rating: 1,
    review: "Poor service!",
  });

  // Explicitly trigger recalculated health (since model hooks for health are removed, we call it in service layer)
  await AccountHealthServices.calculateVendorHealth(vendor._id.toString());

  currentInvs = await InventoryProduct.find({ "seller.vendor": vendor._id });
  winners = currentInvs.filter(i => i.seller.isBuyBoxWinner === true);
  console.log("Winners count after poor rating:", winners.length);
  if (winners.length === 0) {
    console.log("✅ SUCCESS: Ineligible vendor automatically lost all Buy Boxes.");
  } else {
    console.error("❌ FAILURE: Ineligible vendor still has Buy Box winners.");
  }

  // Cleanup
  console.log("\nCleaning up test documents...");
  for (const inv of invs) {
    await InventoryProduct.deleteMany({ _id: inv._id });
  }
  for (const order of orders) {
    await Order.deleteMany({ _id: order._id });
  }
  await Product.deleteMany({ _id: product._id });
  await ServiceReview.deleteMany({ order: orders[0]._id });
  await AccountHealth.deleteMany({ vendor: vendor._id });
  await User.deleteOne({ _id: customer._id });
  await User.deleteOne({ _id: vendor._id });
  console.log("Cleanup finished.");

  await mongoose.disconnect();
  console.log("Disconnected from MongoDB.");
}

runTest().catch((err) => {
  console.error("Test failed with error:", err);
  mongoose.disconnect();
});
