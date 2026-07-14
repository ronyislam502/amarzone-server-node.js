import mongoose from "mongoose";
import config from "../config";
import { User } from "../modules/user/user.model";
import { Product } from "../modules/product/product.model";
import { Order } from "../modules/order/order.model";
import { InventoryProduct } from "../modules/inventory/inventory.model";
import { ServiceReview } from "../modules/review/review.model";
import { AccountHealth } from "../modules/health/health.model";
import { AccountHealthServices } from "../modules/health/health.service";
import { BuyBoxServices } from "../modules/buybox/buybox.service";

async function runTest() {
  console.log("Connecting to Database...");
  await mongoose.connect(config.database_url as string);
  console.log("Connected to MongoDB.");

  // Create mock vendor and customer
  const vendor = await User.create({
    name: "BuyBox Vendor",
    email: `vendor.buybox.${Date.now()}@example.com`,
    password: "password123",
    role: "VENDOR",
    status: "ACTIVE",
  });
  const customer = await User.create({
    name: "BuyBox Customer",
    email: `customer.buybox.${Date.now()}@example.com`,
    password: "password123",
    role: "CUSTOMER",
    status: "ACTIVE",
  });

  // Create mock Product
  const product = await Product.create({
    author: {
      role: "VENDOR",
      id: vendor._id,
      name: vendor.name,
    },
    title: "BuyBox Product",
    description: "Product description",
    asin: `ASIN-${Date.now()}`,
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
        asin: `ASIN-INV-${i}-${Date.now()}`,
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
  
  // Confgured percentage: 25% of 4 products is 1. Expect exactly 1 winner.
  if (winners.length === 1) {
    console.log("✅ SUCCESS: Randomly assigned Buy Box to exactly 1 product (25% of inventory).");
  } else {
    console.error(`❌ FAILURE: Expected 1 winner, got ${winners.length}`);
  }

  // Test 3: Losing Buy Box (customer submits a 1-star Service Review, reducing health rating and ODR)
  console.log("\n--- Test 3: Submitting poor rating (should trigger losing Buy Box) ---");
  const srvReview = await ServiceReview.create({
    customer: customer._id,
    vendor: vendor._id,
    order: orders[0]._id,
    rating: 1,
    review: "Poor service!",
  });

  // Recalculate health & Buy Box
  await AccountHealthServices.calculateVendorHealth(vendor._id.toString());

  currentInvs = await InventoryProduct.find({ "seller.vendor": vendor._id });
  winners = currentInvs.filter(i => i.seller.isBuyBoxWinner === true);
  console.log("Winners count after poor rating:", winners.length);
  if (winners.length === 0) {
    console.log("✅ SUCCESS: Ineligible vendor automatically lost all Buy Boxes.");
  } else {
    console.error("❌ FAILURE: Ineligible vendor still has Buy Box winners.");
  }

  // Test 4: Regaining Buy Box (deleting the poor service review)
  console.log("\n--- Test 4: Removing poor rating (should regain Buy Box) ---");
  await ServiceReview.deleteOne({ _id: srvReview._id });

  // Recalculate health & Buy Box
  await AccountHealthServices.calculateVendorHealth(vendor._id.toString());

  currentInvs = await InventoryProduct.find({ "seller.vendor": vendor._id });
  winners = currentInvs.filter(i => i.seller.isBuyBoxWinner === true);
  console.log("Winners count after review deletion:", winners.length);
  if (winners.length === 1) {
    console.log("✅ SUCCESS: Vendor regained eligibility and randomly assigned Buy Box to 1 product.");
  } else {
    console.error(`❌ FAILURE: Expected 1 winner, got ${winners.length}`);
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
