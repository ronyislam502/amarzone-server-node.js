import mongoose from "mongoose";
import { createServer } from "http";
import config from "../config";
import { User } from "../modules/user/user.model";
import { Product } from "../modules/product/product.model";
import { Order } from "../modules/order/order.model";
import { Category } from "../modules/category/category.model";
import { Department } from "../modules/department/department.model";
import { InventoryProduct } from "../modules/inventory/inventory.model";
import { initSocket } from "../socket/socket";
import { recalculateBestSellers } from "../modules/product/product.service";

async function runTest() {
  console.log("Connecting to Database...");
  await mongoose.connect(config.database_url as string);
  console.log("Connected to MongoDB.");

  // Initialize mock Socket.IO
  const dummyServer = createServer();
  const io = initSocket(dummyServer);
  const emittedEvents: { event: string; payload: any }[] = [];
  
  // Intercept io.emit to capture events
  io.emit = (event: string, data: any) => {
    emittedEvents.push({ event, payload: data });
    console.log(`[Socket Mock] Emitted event "${event}":`, JSON.stringify(data));
    return true as any;
  };

  console.log("Setting up mock database records...");

  // Clean database collections to ensure deterministic test behavior
  await Department.deleteMany({});
  await Category.deleteMany({});
  await Product.deleteMany({});
  await InventoryProduct.deleteMany({});
  await Order.deleteMany({});
  await User.deleteMany({});

  // Create Mock Admin and Customer
  const admin = await User.create({
    name: "System Admin",
    email: `admin.bs.${Date.now()}@example.com`,
    password: "password123",
    role: "ADMIN",
    status: "ACTIVE",
  });

  const vendor = await User.create({
    name: "BestSeller Vendor",
    email: `vendor.bs.${Date.now()}@example.com`,
    password: "password123",
    role: "VENDOR",
    status: "ACTIVE",
  });

  const customer = await User.create({
    name: "BestSeller Customer",
    email: `customer.bs.${Date.now()}@example.com`,
    password: "password123",
    role: "CUSTOMER",
    status: "ACTIVE",
  });

  // Create Mock Department and Categories
  const dept = await Department.create({
    name: "Test Department",
  });

  const cat1 = await Category.create({
    name: "Cat Electronics",
    department: dept._id,
  });

  const cat2 = await Category.create({
    name: "Cat Fashion",
    department: dept._id,
  });

  // Create Products in Cat Electronics (Cat 1)
  const productA = await Product.create({
    author: { role: "ADMIN", id: admin._id, name: admin.name },
    department: dept._id,
    category: cat1._id,
    asin: "ASIN-PROD-A",
    title: "Electronics Product A",
    description: "Product A description",
    brand: "Brand A",
    thumbnail: "a.jpg",
    isDeleted: false,
    variants: [],
    tags: [],
  });

  const productB = await Product.create({
    author: { role: "ADMIN", id: admin._id, name: admin.name },
    department: dept._id,
    category: cat1._id,
    asin: "ASIN-PROD-B",
    title: "Electronics Product B",
    description: "Product B description",
    brand: "Brand B",
    thumbnail: "b.jpg",
    isDeleted: false,
    variants: [],
    tags: [],
  });

  // Create Product in Cat Fashion (Cat 2)
  const productX = await Product.create({
    author: { role: "ADMIN", id: admin._id, name: admin.name },
    department: dept._id,
    category: cat2._id,
    asin: "ASIN-PROD-X",
    title: "Fashion Product X",
    description: "Product X description",
    brand: "Brand X",
    thumbnail: "x.jpg",
    isDeleted: false,
    variants: [],
    tags: [],
  });

  console.log("Creating inventory listings...");
  // Create Inventory for A, B and X (Initial: All in stock)
  const invA = await InventoryProduct.create({
    product: productA._id,
    asin: productA.asin,
    seller: {
      vendor: vendor._id,
      price: 100,
      quantity: 10,
      isStock: true,
      fulfillmentBy: "Merchant",
      shippingTime: 2,
    },
  });

  const invB = await InventoryProduct.create({
    product: productB._id,
    asin: productB.asin,
    seller: {
      vendor: vendor._id,
      price: 150,
      quantity: 10,
      isStock: true,
      fulfillmentBy: "Merchant",
      shippingTime: 2,
    },
  });

  const invX = await InventoryProduct.create({
    product: productX._id,
    asin: productX.asin,
    seller: {
      vendor: vendor._id,
      price: 50,
      quantity: 10,
      isStock: true,
      fulfillmentBy: "Merchant",
      shippingTime: 2,
    },
  });

  // Clear events array
  emittedEvents.length = 0;

  console.log("\n--- TEST 1: Initial state (no sales) ---");
  await recalculateBestSellers();
  let updatedA = await Product.findById(productA._id);
  let updatedB = await Product.findById(productB._id);
  let updatedX = await Product.findById(productX._id);

  console.log("Product A isBestSeller:", updatedA?.isBestSeller);
  console.log("Product B isBestSeller:", updatedB?.isBestSeller);
  console.log("Product X isBestSeller:", updatedX?.isBestSeller);

  if (!updatedA?.isBestSeller && !updatedB?.isBestSeller && !updatedX?.isBestSeller) {
    console.log("✅ TEST 1 PASSED: No product is bestseller when there are 0 completed sales.");
  } else {
    throw new Error("TEST 1 FAILED: A product was marked bestseller without sales.");
  }

  console.log("\n--- TEST 2: Single completed sale for Product A ---");
  emittedEvents.length = 0;
  
  // Create a completed order for Product A
  const order1 = await Order.create({
    customer: customer._id,
    vendor: vendor._id,
    orderNo: "ORD-BS-001",
    products: [{ product: productA._id, quantity: 2 }],
    commission: 15,
    tax: 10,
    totalPrice: 200,
    totalQuantity: 2,
    grandAmount: 220,
    shippedDate: { from: new Date(), to: new Date() },
    deliveryDate: { from: new Date(), to: new Date() },
    status: "DELIVERED",
    paymentStatus: "PAID",
    transactionId: "TX-BS-001",
  });

  // Explicitly call recalculate since Order hooks have been removed
  await recalculateBestSellers();

  // Let's verify if Product A is now Best Seller
  updatedA = await Product.findById(productA._id);
  updatedB = await Product.findById(productB._id);

  console.log("Product A isBestSeller:", updatedA?.isBestSeller);
  console.log("Product B isBestSeller:", updatedB?.isBestSeller);

  if (updatedA?.isBestSeller && !updatedB?.isBestSeller) {
    console.log("✅ TEST 2 PASSED: Product A became bestseller after completed sales.");
  } else {
    throw new Error("TEST 2 FAILED: Product A did not become bestseller.");
  }

  // Verify socket events
  const socketUpdateEvent = emittedEvents.find(e => e.event === "best-seller-updated" && e.payload.productId === productA._id.toString());
  const socketCategoryEvent = emittedEvents.find(e => e.event === "category-best-seller-updated" && e.payload.categoryId === cat1._id.toString());

  if (socketUpdateEvent && socketUpdateEvent.payload.isBestSeller === true && socketCategoryEvent) {
    console.log("✅ TEST 2 SOCKET EVENTS PASSED: Correct updates broadcasted.");
  } else {
    throw new Error("TEST 2 SOCKET EVENTS FAILED.");
  }

  console.log("\n--- TEST 3: Product B sells more than Product A ---");
  emittedEvents.length = 0;

  // Create completed order for Product B
  const order2 = await Order.create({
    customer: customer._id,
    vendor: vendor._id,
    orderNo: "ORD-BS-002",
    products: [{ product: productB._id, quantity: 3 }],
    commission: 15,
    tax: 10,
    totalPrice: 450,
    totalQuantity: 3,
    grandAmount: 495,
    shippedDate: { from: new Date(), to: new Date() },
    deliveryDate: { from: new Date(), to: new Date() },
    status: "COMPLETE",
    paymentStatus: "PAID",
    transactionId: "TX-BS-002",
  });

  // Explicitly call recalculate since Order hooks have been removed
  await recalculateBestSellers();

  // Product B sold 3, Product A sold 2. B should become Best Seller, A should lose it!
  updatedA = await Product.findById(productA._id);
  updatedB = await Product.findById(productB._id);

  console.log("Product A isBestSeller:", updatedA?.isBestSeller);
  console.log("Product B isBestSeller:", updatedB?.isBestSeller);

  if (!updatedA?.isBestSeller && updatedB?.isBestSeller) {
    console.log("✅ TEST 3 PASSED: Badge correctly shifted from Product A to Product B.");
  } else {
    throw new Error("TEST 3 FAILED: Badge did not shift correctly.");
  }

  // Verify socket events
  const bWonEvent = emittedEvents.find(e => e.event === "best-seller-updated" && e.payload.productId === productB._id.toString() && e.payload.isBestSeller === true);
  const aLostEvent = emittedEvents.find(e => e.event === "best-seller-updated" && e.payload.productId === productA._id.toString() && e.payload.isBestSeller === false);

  if (bWonEvent && aLostEvent) {
    console.log("✅ TEST 3 SOCKET EVENTS PASSED: Badge loss/gain events emitted.");
  } else {
    throw new Error("TEST 3 SOCKET EVENTS FAILED.");
  }

  console.log("\n--- TEST 4: Product B goes out of stock ---");
  emittedEvents.length = 0;

  // Set Product B inventory quantity to 0
  await InventoryProduct.findByIdAndUpdate(invB._id, {
    $set: {
      "seller.quantity": 0,
      "seller.isStock": false,
    }
  });

  // Explicitly trigger recalculation since model hooks are removed
  await recalculateBestSellers();

  // Note: Post update hook of InventoryProduct triggers recalculation.
  // Product B has 0 stock. Product A has 10 stock and 2 sales.
  // Product B should lose Best Seller, and Product A should win it!
  updatedA = await Product.findById(productA._id);
  updatedB = await Product.findById(productB._id);

  console.log("Product A isBestSeller:", updatedA?.isBestSeller);
  console.log("Product B isBestSeller:", updatedB?.isBestSeller);

  if (updatedA?.isBestSeller && !updatedB?.isBestSeller) {
    console.log("✅ TEST 4 PASSED: Out-of-stock product lost badge, next available top seller gained it.");
  } else {
    throw new Error("TEST 4 FAILED: Out-of-stock badge adjustment failed.");
  }

  console.log("\n--- TEST 5: Order cancellation/refund ---");
  emittedEvents.length = 0;

  // Cancel order1 (Product A had 2 sales)
  await Order.findByIdAndUpdate(order1._id, {
    $set: {
      status: "CANCELLED",
    }
  });

  // Explicitly call recalculate since Order hooks have been removed
  await recalculateBestSellers();

  // Wait, Product B is out of stock (0 sales score eligibility). Product A sales go down to 0 completed sales.
  // Since both have 0 eligible sales now, neither should have the Best Seller badge!
  updatedA = await Product.findById(productA._id);
  updatedB = await Product.findById(productB._id);

  console.log("Product A isBestSeller:", updatedA?.isBestSeller);
  console.log("Product B isBestSeller:", updatedB?.isBestSeller);

  if (!updatedA?.isBestSeller && !updatedB?.isBestSeller) {
    console.log("✅ TEST 5 PASSED: Best Seller badges removed when all eligible sales are 0.");
  } else {
    throw new Error("TEST 5 FAILED: Bestseller status remained after order cancellation.");
  }

  console.log("\n--- TEST 6: Category Isolation check ---");
  // Set Product B back in stock
  await InventoryProduct.findByIdAndUpdate(invB._id, {
    $set: {
      "seller.quantity": 5,
      "seller.isStock": true,
    }
  });

  // Explicitly trigger recalculation since model hooks are removed
  await recalculateBestSellers();

  // Create completed sales on Category 2 (Product X)
  const order3 = await Order.create({
    customer: customer._id,
    vendor: vendor._id,
    orderNo: "ORD-BS-003",
    products: [{ product: productX._id, quantity: 10 }],
    commission: 15,
    tax: 10,
    totalPrice: 500,
    totalQuantity: 10,
    grandAmount: 550,
    shippedDate: { from: new Date(), to: new Date() },
    deliveryDate: { from: new Date(), to: new Date() },
    status: "COMPLETE",
    paymentStatus: "PAID",
    transactionId: "TX-BS-003",
  });

  // Explicitly call recalculate since Order hooks have been removed
  await recalculateBestSellers();

  // Product X (Cat Fashion) has 10 sales. Product B (Cat Electronics) has 3 sales.
  // Under category isolation, Product X and Product B do not compete.
  // Product B should be bestseller for Cat Electronics, and Product X should be bestseller for Cat Fashion.
  updatedB = await Product.findById(productB._id);
  updatedX = await Product.findById(productX._id);

  console.log("Cat Electronics Product B isBestSeller:", updatedB?.isBestSeller);
  console.log("Cat Fashion Product X isBestSeller:", updatedX?.isBestSeller);

  if (updatedB?.isBestSeller && updatedX?.isBestSeller) {
    console.log("✅ TEST 6 PASSED: Category isolation works perfectly!");
  } else {
    throw new Error("TEST 6 FAILED: Category isolation failed.");
  }

  console.log("\nAll tests completed successfully! Clean up database...");
  await Department.deleteMany({});
  await Category.deleteMany({});
  await Product.deleteMany({});
  await InventoryProduct.deleteMany({});
  await Order.deleteMany({});
  await User.deleteMany({});
  console.log("Database cleaned.");

  await mongoose.disconnect();
  console.log("Disconnected.");
  process.exit(0);
}

runTest().catch(err => {
  console.error("Test failed with error:", err);
  mongoose.disconnect();
  process.exit(1);
});
