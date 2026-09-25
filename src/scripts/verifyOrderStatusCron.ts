import { ORDER_STATUS } from "../app/interface/common";

console.log("=== Running Order Status Progression Cron Logic Tests ===\n");

function evaluateNextStatus(currentStatus: string, shippedAtDate: Date) {
  const now = Date.now();
  const diffDays = (now - shippedAtDate.getTime()) / (1000 * 60 * 60 * 24);

  let newStatus: string | null = null;
  let isDelivered = false;

  if (diffDays >= 5) {
    if (currentStatus !== ORDER_STATUS.DELIVERED) {
      newStatus = ORDER_STATUS.DELIVERED;
      isDelivered = true;
    }
  } else if (diffDays >= 4) {
    if (currentStatus !== ORDER_STATUS.OUT_OF_DELIVERY) {
      newStatus = ORDER_STATUS.OUT_OF_DELIVERY;
    }
  } else if (diffDays >= 2) {
    if (currentStatus === ORDER_STATUS.SHIPPED) {
      newStatus = ORDER_STATUS.IN_TRANSIT;
    }
  }

  return { newStatus: newStatus || currentStatus, isDelivered, diffDays };
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

const now = Date.now();

// Test 1: Shipped 1 day ago -> Should remain SHIPPED
const oneDayAgo = new Date(now - 1 * 24 * 60 * 60 * 1000);
const r1 = evaluateNextStatus(ORDER_STATUS.SHIPPED, oneDayAgo);
assert(r1.newStatus === ORDER_STATUS.SHIPPED, "Order shipped 1 day ago remains SHIPPED");

// Test 2: Shipped 2.5 days ago -> Should advance to IN_TRANSIT
const twoPointFiveDaysAgo = new Date(now - 2.5 * 24 * 60 * 60 * 1000);
const r2 = evaluateNextStatus(ORDER_STATUS.SHIPPED, twoPointFiveDaysAgo);
assert(r2.newStatus === ORDER_STATUS.IN_TRANSIT, "Order shipped 2.5 days ago advances to IN_TRANSIT");

// Test 3: Shipped 4.1 days ago from IN_TRANSIT -> Should advance to OUT_OF_DELIVERY
const fourDaysAgo = new Date(now - 4.1 * 24 * 60 * 60 * 1000);
const r3 = evaluateNextStatus(ORDER_STATUS.IN_TRANSIT, fourDaysAgo);
assert(r3.newStatus === ORDER_STATUS.OUT_OF_DELIVERY, "Order shipped 4.1 days ago advances to OUT_OF_DELIVERY");

// Test 4: Shipped 5.2 days ago from OUT_OF_DELIVERY -> Should advance to DELIVERED
const fiveDaysAgo = new Date(now - 5.2 * 24 * 60 * 60 * 1000);
const r4 = evaluateNextStatus(ORDER_STATUS.OUT_OF_DELIVERY, fiveDaysAgo);
assert(r4.newStatus === ORDER_STATUS.DELIVERED, "Order shipped 5.2 days ago advances to DELIVERED");
assert(r4.isDelivered === true, "Delivered flag is set so deliveredAt timestamp is recorded");

// Test 5: Order already DELIVERED -> No further status change
const r5 = evaluateNextStatus(ORDER_STATUS.DELIVERED, fiveDaysAgo);
assert(r5.newStatus === ORDER_STATUS.DELIVERED, "Order already DELIVERED remains DELIVERED");

console.log(`\nResults: ${passed}/${total} tests passed.`);
if (passed === total) {
  console.log("All order status progression logic tests passed successfully!");
} else {
  process.exit(1);
}
