import PDFDocument from "pdfkit";
import { InvoiceData } from "./invoice.template";

/**
 * Generates an invoice PDF completely in memory and returns it as a Buffer.
 */
export function generateInvoicePdf(invoiceData: InvoiceData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on("data", (chunk) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers as Uint8Array[])));
    doc.on("error", (err) => reject(err));

    // Design invoice PDF
    // Title & Header
    doc.fontSize(20).text("AMARZONE INVOICE", { align: "center" });
    doc.moveDown();

    // Order Meta info
    doc.fontSize(12).text(`Order Number: #${invoiceData.orderNo}`);
    doc.text(`Date: ${invoiceData.createdAt.toLocaleDateString()}`);
    doc.text(`Payment Status: ${invoiceData.paymentStatus}`);
    doc.text(`Order Status: ${invoiceData.orderStatus}`);
    doc.moveDown();

    // Customer details
    doc.text("Bill To:", { underline: true });
    doc.text(`Name: ${invoiceData.customer.name}`);
    doc.text(`Email: ${invoiceData.customer.email}`);
    doc.moveDown();

    // Products Table
    doc.text("Items purchased:", { underline: true });
    doc.moveDown(0.5);

    invoiceData.products.forEach((item, index) => {
      doc.text(
        `${index + 1}. ${item.name} - Qty: ${item.quantity} - Price: $${item.price}`
      );
    });
    doc.moveDown();

    // Summary
    doc.text(`Total Price: $${invoiceData.totalPrice}`);
    doc.text(`Tax: $${invoiceData.tax}`);
    doc.text(`Grand Total: $${invoiceData.grandAmount}`);

    doc.end();
  });
}
