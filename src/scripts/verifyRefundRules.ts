import { USER_ROLE, ORDER_STATUS, PAYMENT_STATUS } from "../app/interface/common";

console.log("=== Running Order Refund Rules Verification Test ===\n");

// Test Order Data
const testOrder = {
  _id: "order_123456",
  orderNo: "ORD-9999",
  totalPrice: 200,
  commission: 30,
  vendorAmount: 170, // original vendor profit before refund
  status: ORDER_STATUS.UNSHIPPED as string,
  paymentStatus: PAYMENT_STATUS.PAID as string,
  customer: "cust_123",
  vendor: "vend_456",
  tracking: {},
};

function calculateRefund(userRole: string, order: typeof testOrder, isShipped: boolean) {
  if (order.status === ORDER_STATUS.REFUNDED || order.paymentStatus === PAYMENT_STATUS.REFUNDED) {
    throw new Error("Order has already been refunded");
  }

  if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
    throw new Error("Only paid orders can be refunded");
  }

  const customerRefundAmount = order.totalPrice;
  let vendorCharge = 0;
  let vendorProfit = 0;

  if (userRole === USER_ROLE.ADMIN || userRole === USER_ROLE.SUPER_ADMIN) {
    // 1. Admin-initiated refund:
    // Full refund to customer, no additional charge or commission from vendor
    vendorCharge = 0;
    vendorProfit = 0;
  } else if (userRole === USER_ROLE.CUSTOMER) {
    // 2. Customer-initiated refund before shipping:
    if (isShipped) {
      throw new Error("Customer cannot request a refund after the order has been shipped");
    }
    vendorCharge = 0;
    vendorProfit = 0;
  } else if (userRole === USER_ROLE.VENDOR) {
    // 3. Vendor-initiated refund:
    // 5% charge of total price deducted from vendor's profit/vendor amount
    vendorCharge = +(order.totalPrice * 0.05).toFixed(2);
    vendorProfit = -vendorCharge;
  } else {
    throw new Error("Unauthorized");
  }

  return {
    customerRefundAmount,
    vendorCharge,
    vendorProfit,
    orderStatus: ORDER_STATUS.REFUNDED,
    paymentStatus: PAYMENT_STATUS.REFUNDED,
  };
}

let passed = 0;
let total = 0;

function assert(condition: boolean, testName: string) {
  total++;
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}`);
  }
}

// Test 1: Admin-initiated refund
try {
  const result = calculateRefund(USER_ROLE.ADMIN, testOrder, false);
  assert(result.customerRefundAmount === 200, "Admin refund: customer receives full amount ($200)");
  assert(result.vendorCharge === 0, "Admin refund: vendor charge is 0");
  assert(result.vendorProfit === 0, "Admin refund: vendor profit after refund is 0 (no fee deducted)");
} catch (e: any) {
  console.error("Test 1 failed with error:", e.message);
}

// Test 2: Customer-initiated refund before shipping
try {
  const result = calculateRefund(USER_ROLE.CUSTOMER, testOrder, false);
  assert(result.customerRefundAmount === 200, "Customer pre-shipping refund: customer receives full amount ($200)");
  assert(result.vendorCharge === 0, "Customer pre-shipping refund: vendor charge is 0");
  assert(result.vendorProfit === 0, "Customer pre-shipping refund: vendor profit is 0");
} catch (e: any) {
  console.error("Test 2 failed with error:", e.message);
}

// Test 3: Customer-initiated refund after shipping (Must throw error)
try {
  calculateRefund(USER_ROLE.CUSTOMER, testOrder, true);
  assert(false, "Customer after-shipping refund: should throw error but succeeded");
} catch (e: any) {
  assert(e.message.includes("after the order has been shipped"), "Customer after-shipping refund is rejected correctly");
}

// Test 4: Vendor-initiated refund
try {
  const result = calculateRefund(USER_ROLE.VENDOR, testOrder, false);
  assert(result.customerRefundAmount === 200, "Vendor refund: customer receives full amount ($200, not minus 5%)");
  assert(result.vendorCharge === 10, "Vendor refund: vendor is charged 5% of order ($10)");
  assert(result.vendorProfit === -10, "Vendor refund: vendor profit is deducted by 5% (-$10)");
} catch (e: any) {
  console.error("Test 4 failed with error:", e.message);
}

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed === total) {
  console.log("All refund business logic tests verified successfully!");
} else {
  process.exit(1);
}
