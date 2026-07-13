export interface InvoiceItem {
  name: string;
  quantity: number;
  price: number;
}

export interface InvoiceData {
  orderNo: string;
  createdAt: Date;
  paymentStatus: string;
  orderStatus: string;
  customer: {
    name: string;
    email: string;
  };
  products: InvoiceItem[];
  totalPrice: number;
  tax: number;
  grandAmount: number;
}

/**
 * Formats order data populated from the database into clean, decoupled InvoiceData
 */
export function generateInvoiceData(orderData: any): InvoiceData {
  const customerUser = orderData.customer as any;
  const products: InvoiceItem[] = (orderData.products || []).map((item: any) => {
    const product = item.product;
    return {
      name: product?.name || "Product",
      quantity: item.quantity || 0,
      price: product?.price || 0,
    };
  });

  return {
    orderNo: orderData.orderNo || "",
    createdAt: orderData.createdAt ? new Date(orderData.createdAt) : new Date(),
    paymentStatus: orderData.paymentStatus || "PENDING",
    orderStatus: orderData.status || "PENDING",
    customer: {
      name: customerUser?.name || "Customer",
      email: customerUser?.email || "N/A",
    },
    products,
    totalPrice: orderData.totalPrice || 0,
    tax: orderData.tax || 0,
    grandAmount: orderData.grandAmount || 0,
  };
}

/**
 * Generates the HTML template for the customer invoice notification email
 */
export function generateCustomerEmailHtml(orderData: any, customerUser: any, receiptUrl: string): string {
  return `
    <h2>Payment Successful & Order Confirmation</h2>
    <p>Hello ${customerUser?.name || "Customer"},</p>
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
}

/**
 * Generates the HTML template for the vendor invoice notification email
 */
export function generateVendorEmailHtml(orderData: any, vendorUser: any, customerUser: any): string {
  return `
    <h2>New Order Received</h2>
    <p>Hello ${vendorUser?.name || "Vendor"},</p>
    <p>You have received a new paid order <strong>#${orderData.orderNo}</strong>.</p>
    <p><strong>Customer Details:</strong></p>
    <ul>
      <li>Name: ${customerUser?.name || "Customer"}</li>
      <li>Email: ${customerUser?.email || "N/A"}</li>
    </ul>
    <p>Please prepare the package for shipment.</p>
  `;
}
