import * as fs from "fs";
import puppeteer from "puppeteer-core";
import { cloudinaryUpload } from "../config/cloudinary.config";

export interface IInvoiceItem {
  itemNo: number;
  title: string;
  variantInfo?: string;
  sellerName: string;
  fulfilledBy?: string;
  asin: string;
  sku: string;
  price: number;
  quantity: number;
  total: number;
  image?: string;
}

export interface IInvoiceAddress {
  name: string;
  street: string;
  cityStateZip: string;
  country: string;
  phone: string;
  email?: string;
}

export interface IInvoiceData {
  invoiceNo: string;
  invoiceDate: string;
  orderId: string;
  orderDate: string;
  paymentMethod: string;
  paymentStatus: "Paid" | "Pending" | "Failed" | "Refunded" | string;
  fulfillmentBy: string;

  billingAddress: IInvoiceAddress;
  shippingAddress: IInvoiceAddress;

  items: IInvoiceItem[];

  subtotal: number;
  shippingFee: number;
  sellerHandlingFee: number;
  discount: number;
  grandTotal: number;
  grandTotalInWords?: string;

  currencySymbol?: string;
}

// Convert numbers into words (e.g. 9067 -> Nine Thousand Sixty Seven)
const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertLessThanThousand(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ones[n];

  const ten = Math.floor(n / 10);
  const remainder = n % 10;
  if (n < 100) {
    return remainder > 0 ? `${tens[ten]} ${ones[remainder]}` : tens[ten];
  }

  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const restStr = rest > 0 ? ` ${convertLessThanThousand(rest)}` : "";
  return `${ones[hundred]} Hundred${restStr}`;
}

export function numberToWords(num: number): string {
  if (num === 0) return "Zero";
  const rounded = Math.round(Math.abs(num));

  const crores = Math.floor(rounded / 10000000);
  let rem = rounded % 10000000;
  const lakhs = Math.floor(rem / 100000);
  rem = rem % 100000;
  const thousands = Math.floor(rem / 1000);
  const remaining = rem % 1000;

  let result = "";

  if (crores > 0) {
    result += `${convertLessThanThousand(crores)} Crore `;
  }
  if (lakhs > 0) {
    result += `${convertLessThanThousand(lakhs)} Lakh `;
  }
  if (thousands > 0) {
    result += `${convertLessThanThousand(thousands)} Thousand `;
  }
  if (remaining > 0) {
    result += `${convertLessThanThousand(remaining)} `;
  }

  return result.trim();
}

/**
 * Generates an SVG Barcode matching Code 128 format
 */
function generateBarcodeSvg(code: string): string {
  const bars: { width: number; isSpace: boolean }[] = [];
  bars.push({ width: 3, isSpace: false });
  bars.push({ width: 2, isSpace: true });
  bars.push({ width: 1, isSpace: false });
  bars.push({ width: 2, isSpace: true });

  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    const pattern = [
      ((charCode * 3) % 4) + 1,
      ((charCode * 5) % 3) + 1,
      ((charCode * 7) % 4) + 1,
      ((charCode * 2) % 3) + 1,
    ];
    for (let j = 0; j < pattern.length; j++) {
      bars.push({
        width: pattern[j],
        isSpace: j % 2 === 1,
      });
    }
  }

  bars.push({ width: 3, isSpace: false });
  bars.push({ width: 1, isSpace: true });
  bars.push({ width: 4, isSpace: false });

  let currentX = 10;
  let rects = "";
  for (const bar of bars) {
    if (!bar.isSpace) {
      rects += `<rect x="${currentX}" y="2" width="${bar.width * 1.5}" height="42" fill="#111827"/>`;
    }
    currentX += bar.width * 1.5;
  }

  const totalWidth = currentX + 10;

  return `
    <svg viewBox="0 0 ${totalWidth} 48" class="barcode-svg" xmlns="http://www.w3.org/2000/svg">
      <rect width="${totalWidth}" height="48" fill="#ffffff" rx="2" />
      ${rects}
    </svg>
  `;
}

/**
 * Generates a clean QR code SVG
 */
function generateQrCodeSvg(): string {
  return `
    <svg viewBox="0 0 100 100" class="qr-svg" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#ffffff" rx="6" />
      <!-- Top-left finder -->
      <rect x="10" y="10" width="26" height="26" fill="#111827" rx="3" />
      <rect x="14" y="14" width="18" height="18" fill="#ffffff" rx="2" />
      <rect x="18" y="18" width="10" height="10" fill="#111827" rx="1" />
      <!-- Top-right finder -->
      <rect x="64" y="10" width="26" height="26" fill="#111827" rx="3" />
      <rect x="68" y="14" width="18" height="18" fill="#ffffff" rx="2" />
      <rect x="72" y="18" width="10" height="10" fill="#111827" rx="1" />
      <!-- Bottom-left finder -->
      <rect x="10" y="64" width="26" height="26" fill="#111827" rx="3" />
      <rect x="14" y="68" width="18" height="18" fill="#ffffff" rx="2" />
      <rect x="18" y="72" width="10" height="10" fill="#111827" rx="1" />
      <!-- Data modules -->
      <rect x="42" y="12" width="5" height="5" fill="#111827" />
      <rect x="51" y="15" width="5" height="5" fill="#111827" />
      <rect x="44" y="24" width="6" height="6" fill="#111827" />
      <rect x="52" y="30" width="5" height="5" fill="#111827" />
      <rect x="12" y="44" width="6" height="5" fill="#111827" />
      <rect x="22" y="48" width="5" height="6" fill="#111827" />
      <rect x="32" y="42" width="6" height="6" fill="#111827" />
      <rect x="42" y="44" width="6" height="6" fill="#111827" />
      <rect x="52" y="42" width="6" height="6" fill="#111827" />
      <rect x="64" y="44" width="6" height="6" fill="#111827" />
      <rect x="74" y="42" width="5" height="6" fill="#111827" />
      <rect x="83" y="46" width="6" height="5" fill="#111827" />
      <rect x="42" y="54" width="6" height="6" fill="#111827" />
      <rect x="52" y="56" width="6" height="6" fill="#111827" />
      <rect x="64" y="54" width="6" height="6" fill="#111827" />
      <rect x="76" y="56" width="5" height="5" fill="#111827" />
      <rect x="42" y="68" width="6" height="6" fill="#111827" />
      <rect x="52" y="72" width="6" height="6" fill="#111827" />
      <rect x="62" y="66" width="6" height="6" fill="#111827" />
      <rect x="72" y="72" width="6" height="6" fill="#111827" />
      <rect x="82" y="68" width="6" height="6" fill="#111827" />
      <rect x="42" y="82" width="6" height="6" fill="#111827" />
      <rect x="54" y="84" width="5" height="5" fill="#111827" />
      <rect x="64" y="82" width="6" height="6" fill="#111827" />
      <rect x="76" y="82" width="6" height="6" fill="#111827" />
      <rect x="84" y="84" width="5" height="5" fill="#111827" />
    </svg>
  `;
}

/**
 * Generates identical HTML matching the Amarzone PDF invoice layout
 */
export function generateInvoiceHtml(data: IInvoiceData): string {
  const currency = data.currencySymbol || "৳";
  const words =
    data.grandTotalInWords ||
    `(BDT ${numberToWords(data.grandTotal)} Only)`;

  const barcodeSvg = generateBarcodeSvg(data.invoiceNo || data.orderId || "AZ-INV-2026-000245");
  const qrCodeSvg = generateQrCodeSvg();

  const itemsHtml = data.items
    .map(
      (item) => `
      <tr class="item-row">
        <td class="col-center item-num">${item.itemNo}</td>
        <td class="col-product">
          <div class="product-wrapper">
            <div class="product-thumb">
              ${
                item.image
                  ? `<img src="${item.image}" alt="${item.title}" class="thumb-img" />`
                  : `<svg viewBox="0 0 24 24" class="thumb-icon" fill="none" stroke="#9ca3af" stroke-width="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>`
              }
            </div>
            <div class="product-info">
              <div class="product-title">${item.title}</div>
              ${
                item.variantInfo
                  ? `<div class="product-variant">${item.variantInfo}</div>`
                  : ""
              }
            </div>
          </div>
        </td>
        <td class="col-seller">
          <div class="seller-name">${item.sellerName}</div>
          <div class="fulfilled-badge ${
            (item.fulfilledBy || "").toLowerCase().includes("amarzone")
              ? "badge-amarzone"
              : "badge-seller"
          }">
            ${
              item.fulfilledBy
                ? item.fulfilledBy.startsWith("Fulfilled")
                  ? item.fulfilledBy
                  : `Fulfilled by ${item.fulfilledBy}`
                : "Fulfilled by Amarzone"
            }
          </div>
        </td>
        <td class="col-asin-sku">
          <div class="asin-line"><strong>ASIN:</strong> ${item.asin}</div>
          <div class="sku-line">SKU: ${item.sku}</div>
        </td>
        <td class="col-price">${currency} ${item.price.toLocaleString("en-US")}</td>
        <td class="col-center col-qty">${item.quantity}</td>
        <td class="col-total">${currency} ${item.total.toLocaleString("en-US")}</td>
      </tr>
    `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${data.invoiceNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #ffffff;
      color: #111827;
      font-size: 12px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    .invoice-container {
      width: 800px;
      margin: 0 auto;
      background-color: #ffffff;
      position: relative;
      overflow: hidden;
    }

    /* TOP HEADER */
    .header-wrapper {
      position: relative;
      background: #090b0e;
      color: #ffffff;
      padding: 30px 38px 45px 38px;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      position: relative;
      z-index: 2;
    }

    /* BRAND / LOGO */
    .brand-section {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .logo-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .brand-ring-icon {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 3px solid #dfa841;
      background: radial-gradient(circle at 30% 30%, #1e2229 0%, #090b0e 100%);
      box-shadow: 0 0 10px rgba(223, 168, 65, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-text-wrap {
      display: flex;
      flex-direction: column;
    }

    .brand-title {
      font-size: 30px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #e5a93c;
      line-height: 1;
      display: flex;
      flex-direction: column;
      position: relative;
    }

    .smile-arrow {
      width: 135px;
      height: 14px;
      margin-top: -2px;
    }

    .brand-slogan {
      color: #ffffff;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.3px;
      margin-top: 4px;
    }

    /* INVOICE TITLE & BARCODE */
    .invoice-meta-section {
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .invoice-heading {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: 1.5px;
      color: #dfa841;
      line-height: 1;
    }

    .invoice-number-tag {
      font-size: 14px;
      font-weight: 700;
      color: #e5a93c;
      margin-top: 5px;
    }

    .invoice-date-tag {
      font-size: 12px;
      color: #e5e7eb;
      margin-top: 2px;
      margin-bottom: 12px;
    }

    .barcode-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      background: transparent;
    }

    .barcode-svg {
      width: 195px;
      height: 38px;
      border-radius: 2px;
    }

    .barcode-label {
      font-size: 10px;
      letter-spacing: 1px;
      color: #f3f4f6;
      font-weight: 600;
      margin-top: 3px;
    }

    /* CURVED GOLD DIVIDER AT HEADER BOTTOM */
    .header-wave {
      position: absolute;
      bottom: -1px;
      left: 0;
      width: 100%;
      height: 38px;
      z-index: 1;
      pointer-events: none;
    }

    /* BODY CONTAINER */
    .main-body {
      padding: 20px 38px 24px 38px;
    }

    /* THANK YOU BANNER */
    .thankyou-banner {
      margin-bottom: 20px;
    }

    .thankyou-heading {
      font-size: 18px;
      font-weight: 800;
      color: #111827;
    }

    .highlight-gold {
      color: #dfa841;
    }

    .thankyou-sub {
      font-size: 13px;
      color: #6b7280;
      margin-top: 3px;
    }

    /* 3 SUMMARY CARDS */
    .cards-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 16px;
      margin-bottom: 22px;
    }

    .info-card {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 14px 16px;
      background: #ffffff;
      min-height: 195px;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
    }

    .icon-badge {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #fdf8ed;
      border: 1px solid #f2cf85;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #c2851a;
      flex-shrink: 0;
    }

    .card-title {
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #111827;
      text-transform: uppercase;
    }

    .address-name {
      font-size: 13px;
      font-weight: 700;
      color: #111827;
      margin-bottom: 4px;
    }

    .address-line {
      font-size: 12px;
      color: #4b5563;
      line-height: 1.5;
    }

    .contact-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #374151;
      margin-top: 6px;
    }

    /* ORDER META CARD */
    .order-meta-card {
      display: flex;
      flex-direction: column;
      gap: 9px;
    }

    .meta-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .meta-icon-badge {
      width: 24px;
      height: 24px;
      border-radius: 4px;
      background: #fdf8ed;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #c2851a;
      flex-shrink: 0;
    }

    .meta-content {
      display: flex;
      flex-direction: column;
    }

    .meta-label {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      color: #111827;
      letter-spacing: 0.4px;
    }

    .meta-val {
      font-size: 12px;
      color: #4b5563;
      font-weight: 500;
    }

    .meta-val-paid {
      color: #16a34a;
      font-weight: 700;
    }

    /* ITEMS TABLE */
    .table-section {
      margin-bottom: 22px;
    }

    .invoice-table {
      width: 100%;
      border-collapse: collapse;
    }

    .invoice-table thead tr {
      background: #0d0f12;
    }

    .invoice-table th {
      padding: 10px 10px;
      color: #dfa841;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.6px;
      text-transform: uppercase;
      border: none;
    }

    .th-num { width: 5%; text-align: center; }
    .th-product { width: 33%; text-align: left; }
    .th-seller { width: 17%; text-align: left; }
    .th-asin { width: 18%; text-align: left; }
    .th-price { width: 10%; text-align: right; }
    .th-qty { width: 6%; text-align: center; }
    .th-total { width: 11%; text-align: right; }

    .item-row td {
      padding: 12px 10px;
      border-bottom: 1px solid #f1f3f5;
      vertical-align: middle;
    }

    .col-center { text-align: center; }
    .col-price { text-align: right; font-weight: 600; color: #111827; font-size: 12px; }
    .col-qty { font-weight: 600; color: #111827; font-size: 12px; }
    .col-total { text-align: right; font-weight: 700; color: #111827; font-size: 12px; }

    .item-num {
      font-weight: 600;
      color: #374151;
      font-size: 12px;
    }

    .product-wrapper {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .product-thumb {
      width: 44px;
      height: 44px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
      background: #fafafa;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
    }

    .thumb-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .thumb-icon {
      width: 22px;
      height: 22px;
    }

    .product-info {
      display: flex;
      flex-direction: column;
    }

    .product-title {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
      line-height: 1.3;
    }

    .product-variant {
      font-size: 11px;
      color: #6b7280;
      margin-top: 2px;
    }

    .seller-name {
      font-size: 12px;
      font-weight: 700;
      color: #111827;
    }

    .fulfilled-badge {
      display: inline-block;
      font-size: 9.5px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
      margin-top: 4px;
      text-align: center;
    }

    .badge-amarzone {
      border: 1px solid #dfa841;
      background: #fffdf5;
      color: #b46d0e;
    }

    .badge-seller {
      border: 1px solid #dfa841;
      background: #fffdf5;
      color: #b46d0e;
    }

    .asin-line {
      font-size: 11px;
      color: #111827;
    }

    .sku-line {
      font-size: 10.5px;
      color: #6b7280;
      margin-top: 2px;
    }

    /* SUMMARY / SUB-SECTION */
    .summary-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      align-items: start;
      margin-bottom: 24px;
    }

    /* LEFT NOTES */
    .left-notes-column {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .appreciate-card {
      background: #11141a;
      border-radius: 8px;
      padding: 14px 16px;
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .appreciate-icon-ring {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 2px solid #dfa841;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #dfa841;
      flex-shrink: 0;
    }

    .appreciate-heading {
      color: #dfa841;
      font-size: 13px;
      font-weight: 700;
    }

    .appreciate-text {
      color: #d1d5db;
      font-size: 11px;
      margin-top: 2px;
      line-height: 1.35;
    }

    .policy-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 12px 14px;
    }

    .policy-title {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #c2851a;
      text-transform: uppercase;
    }

    .policy-text {
      font-size: 11px;
      color: #4b5563;
      margin-top: 4px;
      line-height: 1.4;
    }

    /* RIGHT TOTALS */
    .calc-box {
      background: #ffffff;
      padding: 4px 6px;
    }

    .calc-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 5px 0;
      font-size: 12.5px;
      color: #374151;
      font-weight: 500;
    }

    .discount-val {
      color: #16a34a;
      font-weight: 600;
    }

    .calc-divider {
      border-top: 1px solid #e5e7eb;
      margin: 10px 0 8px 0;
    }

    .grand-total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 4px;
    }

    .grand-total-label {
      font-size: 16px;
      font-weight: 800;
      color: #111827;
      letter-spacing: 0.5px;
    }

    .grand-total-val {
      font-size: 22px;
      font-weight: 800;
      color: #c2851a;
    }

    .grand-total-words {
      text-align: right;
      font-size: 10.5px;
      color: #6b7280;
      margin-top: 4px;
    }

    /* FOOTER SECTION */
    .footer-wrapper {
      background: #090b0e;
      color: #ffffff;
      border-top: 2.5px solid #dfa841;
      padding: 24px 38px 16px 38px;
    }

    .footer-columns {
      display: grid;
      grid-template-columns: 1.3fr 1fr 1fr;
      gap: 20px;
    }

    /* FOOTER COL 1 */
    .footer-col-brand {
      display: flex;
      align-items: flex-start;
      gap: 14px;
    }

    .footer-monogram {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 2.5px solid #dfa841;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #dfa841;
      font-size: 26px;
      font-weight: 800;
      flex-shrink: 0;
      background: #11141a;
      position: relative;
    }

    .footer-info {
      display: flex;
      flex-direction: column;
    }

    .footer-brand-name {
      color: #dfa841;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.6px;
    }

    .footer-unit-title {
      font-size: 10px;
      color: #9ca3af;
      margin-top: 1px;
    }

    .footer-address {
      font-size: 10px;
      color: #9ca3af;
      line-height: 1.4;
      margin-top: 4px;
    }

    .footer-contact {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 10px;
      color: #d1d5db;
      margin-top: 4px;
    }

    /* FOOTER COL 2 */
    .footer-col-help {
      display: flex;
      flex-direction: column;
      border-left: 1px solid rgba(223, 168, 65, 0.25);
      padding-left: 20px;
    }

    .help-heading {
      color: #dfa841;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
    }

    .help-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: #d1d5db;
      margin-bottom: 4px;
    }

    /* FOOTER COL 3 */
    .footer-col-social {
      display: flex;
      flex-direction: column;
      border-left: 1px solid rgba(223, 168, 65, 0.25);
      padding-left: 20px;
    }

    .social-heading {
      color: #dfa841;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .social-icons-row {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }

    .social-icon-circle {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #dfa841;
      color: #090b0e;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 12px;
    }

    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .qr-svg {
      width: 52px;
      height: 52px;
      border-radius: 4px;
    }

    .qr-caption {
      font-size: 9px;
      color: #9ca3af;
      margin-top: 4px;
      text-align: right;
    }

    /* BOTTOM MOST STRIP */
    .bottom-strip {
      background: #040507;
      text-align: center;
      padding: 9px 0;
      font-size: 11px;
      color: #ffffff;
      font-weight: 500;
      letter-spacing: 0.3px;
    }
  </style>
</head>
<body>

<div class="invoice-container">
  <!-- TOP HEADER -->
  <header class="header-wrapper">
    <div class="header-content">
      <!-- LEFT BRAND -->
      <div class="brand-section">
        <div class="logo-row">
          <div class="brand-ring-icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#dfa841" stroke-width="2.5">
              <circle cx="12" cy="12" r="9" stroke="#dfa841" stroke-width="2" />
              <path d="M7 13 C9 16 15 16 17 13" stroke="#dfa841" stroke-width="2.2" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="logo-text-wrap">
            <div class="brand-title">
              <span>amarzone</span>
              <!-- Amarzone smile curve -->
              <svg class="smile-arrow" viewBox="0 0 135 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 3C25 11 95 13 130 3" stroke="#dfa841" stroke-width="3" stroke-linecap="round"/>
                <path d="M125 1L133 3.5L127 8" fill="#dfa841"/>
              </svg>
            </div>
          </div>
        </div>
        <div class="brand-slogan">Shop More, Pay Less</div>
      </div>

      <!-- RIGHT INVOICE TAG & BARCODE -->
      <div class="invoice-meta-section">
        <div class="invoice-heading">INVOICE</div>
        <div class="invoice-number-tag">#${data.invoiceNo}</div>
        <div class="invoice-date-tag">Date: ${data.invoiceDate}</div>
        <div class="barcode-box">
          ${barcodeSvg}
          <div class="barcode-label">${data.invoiceNo}</div>
        </div>
      </div>
    </div>

    <!-- WAVE AT BOTTOM OF HEADER -->
    <svg class="header-wave" viewBox="0 0 800 38" fill="none" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#dfa841"/>
          <stop offset="50%" stop-color="#f5cf7b"/>
          <stop offset="100%" stop-color="#dfa841"/>
        </linearGradient>
      </defs>
      <path d="M0,0 L800,0 L800,8 C640,32 460,2 240,26 C120,38 40,30 0,22 Z" fill="#090b0e"/>
      <path d="M0,22 C40,30 120,38 240,26 C460,2 640,32 800,8" stroke="url(#goldGradient)" stroke-width="3" fill="none"/>
    </svg>
  </header>

  <!-- BODY CONTENT -->
  <main class="main-body">
    <!-- GREETING -->
    <section class="thankyou-banner">
      <div class="thankyou-heading">Thank you for shopping with <span class="highlight-gold">Amarzone!</span></div>
      <div class="thankyou-sub">Your order has been received and is being processed.</div>
    </section>

    <!-- 3 SUMMARY CARDS -->
    <section class="cards-row">
      <!-- BILLING ADDRESS -->
      <div class="info-card">
        <div class="card-header">
          <div class="icon-badge">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <div class="card-title">Billing Address</div>
        </div>
        <div class="address-name">${data.billingAddress.name}</div>
        <div class="address-line">${data.billingAddress.street}</div>
        <div class="address-line">${data.billingAddress.cityStateZip}</div>
        <div class="address-line">${data.billingAddress.country}</div>
        <div class="contact-item">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#374151" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <span>${data.billingAddress.phone}</span>
        </div>
        ${
          data.billingAddress.email
            ? `
        <div class="contact-item">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#374151" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span>${data.billingAddress.email}</span>
        </div>`
            : ""
        }
      </div>

      <!-- SHIPPING ADDRESS -->
      <div class="info-card">
        <div class="card-header">
          <div class="icon-badge">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M20 8h-3V4H1v13h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
            </svg>
          </div>
          <div class="card-title">Shipping Address</div>
        </div>
        <div class="address-name">${data.shippingAddress.name}</div>
        <div class="address-line">${data.shippingAddress.street}</div>
        <div class="address-line">${data.shippingAddress.cityStateZip}</div>
        <div class="address-line">${data.shippingAddress.country}</div>
        <div class="contact-item">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#374151" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <span>${data.shippingAddress.phone}</span>
        </div>
      </div>

      <!-- ORDER DETAILS -->
      <div class="info-card order-meta-card">
        <div class="meta-row">
          <div class="meta-icon-badge">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58v.23z"/>
            </svg>
          </div>
          <div class="meta-content">
            <div class="meta-label">Order ID</div>
            <div class="meta-val">${data.orderId}</div>
          </div>
        </div>
        <div class="meta-row">
          <div class="meta-icon-badge">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11z"/>
            </svg>
          </div>
          <div class="meta-content">
            <div class="meta-label">Order Date</div>
            <div class="meta-val">${data.orderDate}</div>
          </div>
        </div>
        <div class="meta-row">
          <div class="meta-icon-badge">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
            </svg>
          </div>
          <div class="meta-content">
            <div class="meta-label">Payment Method</div>
            <div class="meta-val">${data.paymentMethod}</div>
          </div>
        </div>
        <div class="meta-row">
          <div class="meta-icon-badge">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
            </svg>
          </div>
          <div class="meta-content">
            <div class="meta-label">Payment Status</div>
            <div class="meta-val meta-val-paid">${data.paymentStatus}</div>
          </div>
        </div>
        <div class="meta-row">
          <div class="meta-icon-badge">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M19 13v6c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2v-6H2V9c0-1.1.9-2 2-2h16c1.1 0 2 .9 2 2v4h-3zM7 19h10v-6H7v6zM4 9v2h16V9H4z"/>
            </svg>
          </div>
          <div class="meta-content">
            <div class="meta-label">Fulfillment By</div>
            <div class="meta-val">${data.fulfillmentBy}</div>
          </div>
        </div>
      </div>
    </section>

    <!-- PRODUCTS TABLE -->
    <section class="table-section">
      <table class="invoice-table">
        <thead>
          <tr>
            <th class="th-num">#</th>
            <th class="th-product">Product</th>
            <th class="th-seller">Seller</th>
            <th class="th-asin">ASIN / SKU</th>
            <th class="th-price">Price</th>
            <th class="th-qty">Qty</th>
            <th class="th-total">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
    </section>

    <!-- SUMMARY SECTION -->
    <section class="summary-section">
      <div class="left-notes-column">
        <div class="appreciate-card">
          <div class="appreciate-icon-ring">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#dfa841" stroke-width="2">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
            </svg>
          </div>
          <div>
            <div class="appreciate-heading">We appreciate your business!</div>
            <div class="appreciate-text">If you have any questions,<br>feel free to contact our support team.</div>
          </div>
        </div>

        <div class="policy-card">
          <div class="policy-title">Return & Refund Policy</div>
          <div class="policy-text">
            You can return most items within 7 days of delivery. For details, please visit our website or contact support.
          </div>
        </div>
      </div>

      <div class="calc-box">
        <div class="calc-row">
          <span>Subtotal</span>
          <span>${currency} ${data.subtotal.toLocaleString("en-US")}</span>
        </div>
        <div class="calc-row">
          <span>Shipping Fee</span>
          <span>${currency} ${data.shippingFee.toLocaleString("en-US")}</span>
        </div>
        <div class="calc-row">
          <span>Seller Handling Fee</span>
          <span>${currency} ${data.sellerHandlingFee.toLocaleString("en-US")}</span>
        </div>
        <div class="calc-row">
          <span>Discount</span>
          <span class="discount-val">- ${currency} ${data.discount.toLocaleString("en-US")}</span>
        </div>
        <div class="calc-divider"></div>
        <div class="grand-total-row">
          <span class="grand-total-label">GRAND TOTAL</span>
          <span class="grand-total-val">${currency} ${data.grandTotal.toLocaleString("en-US")}</span>
        </div>
        <div class="grand-total-words">${words}</div>
      </div>
    </section>
  </main>

  <!-- FOOTER -->
  <footer class="footer-wrapper">
    <div class="footer-columns">
      <div class="footer-col-brand">
        <div class="footer-monogram">
          <span>a</span>
          <svg style="position:absolute; bottom:6px; width:26px; height:8px;" viewBox="0 0 30 8" fill="none">
            <path d="M2 2C10 7 20 7 28 2" stroke="#dfa841" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="footer-info">
          <div class="footer-brand-name">AMARZONE</div>
          <div class="footer-unit-title">A Unit of Amarzone Ltd.</div>
          <div class="footer-address">
            House: 21, Road: 3, Block: C<br>
            Bashundhara R/A, Dhaka 1229,<br>
            Bangladesh
          </div>
          <div class="footer-contact">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#d1d5db" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <span>+880 9612 345678</span>
          </div>
          <div class="footer-contact">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#d1d5db" stroke-width="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <span>support@amarzone.com</span>
          </div>
        </div>
      </div>

      <div class="footer-col-help">
        <div class="help-heading">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#dfa841" stroke-width="2">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
          <span>Need Help?</span>
        </div>
        <div class="help-item">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#d1d5db" stroke-width="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <span>support@amarzone.com</span>
        </div>
        <div class="help-item">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#d1d5db" stroke-width="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
          <span>+880 9612 345678</span>
        </div>
        <div class="help-item">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#d1d5db" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span>www.amarzone.com</span>
        </div>
        <div class="help-item">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#d1d5db" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span>Live Chat: amarzone.com/chat</span>
        </div>
      </div>

      <div class="footer-col-social">
        <div class="social-heading">Follow Us</div>
        <div class="social-icons-row">
          <div class="social-icon-circle">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="#090b0e">
              <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
            </svg>
          </div>
          <div class="social-icon-circle">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#090b0e" stroke-width="2">
              <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
              <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
              <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
            </svg>
          </div>
          <div class="social-icon-circle">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="#090b0e">
              <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
              <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="#dfa841"/>
            </svg>
          </div>
          <div class="social-icon-circle">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="#090b0e">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
              <rect x="2" y="9" width="4" height="12"/>
              <circle cx="4" cy="4" r="2"/>
            </svg>
          </div>
        </div>

        <div class="qr-container">
          ${qrCodeSvg}
          <div class="qr-caption">Scan to visit<br>our website</div>
        </div>
      </div>
    </div>
  </footer>

  <!-- BOTTOM STRIP -->
  <div class="bottom-strip">
    Thank you for choosing <span style="color:#dfa841; font-weight:700;">Amarzone</span>. Happy Shopping!
  </div>
</div>

</body>
</html>`;
}

/**
 * Locate Chrome or Edge executable on host system
 */
function getBrowserExecutablePath(): string {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const possiblePaths = [
    // Windows Google Chrome
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    // Windows Microsoft Edge
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    // Linux
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  throw new Error(
    "Could not find Chrome or Edge executable. Please set CHROME_PATH environment variable."
  );
}

/**
 * Generates identical PDF buffer from invoice data
 */
export async function generateInvoicePdf(data: IInvoiceData): Promise<Buffer> {
  const executablePath = getBrowserExecutablePath();
  const html = generateInvoiceHtml(data);

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=none",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 1130, deviceScaleFactor: 2 });
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
    });

    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    return Buffer.from(pdfUint8Array);
  } finally {
    await browser.close();
  }
}

/**
 * Maps a MongoDB Order document to IInvoiceData
 */
export function mapOrderToInvoiceData(order: any, customerProfile?: any): IInvoiceData {
  const customerUser = order.customer || {};
  const customer = customerProfile || customerUser;
  const address = customer.address || {};

  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const formattedDate = orderDate.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const formattedDateTime = `${formattedDate}, ${orderDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  const items = (order.products || []).map((item: any, idx: number) => {
    const variant = item.variant || {};
    const product = variant.product || {};

    const colorAttr = (variant.attributes || []).find(
      (a: any) => a.type?.toLowerCase() === "color"
    );
    const variantInfo = colorAttr
      ? `Color: ${colorAttr.value}`
      : variant.attributes?.[0]
      ? `${variant.attributes[0].type}: ${variant.attributes[0].value}`
      : undefined;

    const unitPrice = item.price || 0;
    const qty = item.quantity || 1;

    return {
      itemNo: idx + 1,
      title: product.title || "Product Item",
      variantInfo,
      sellerName: order.vendor?.name || "Amarzone",
      fulfilledBy: "Amarzone",
      asin: variant.asin || "AZH10001",
      sku: variant.sku || "SKU-001",
      price: unitPrice,
      quantity: qty,
      total: unitPrice * qty,
      image: product.thumbnail || variant.images?.[0] || undefined,
    };
  });

  const subtotal = items.reduce((sum: number, it: any) => sum + it.total, 0);
  const shippingFee = 120;
  const sellerHandlingFee = 60;
  const discount = Math.max(0, subtotal + shippingFee + sellerHandlingFee - (order.totalPrice || subtotal));
  const grandTotal = order.totalPrice || subtotal;

  const invoiceNo = `AZ-INV-${order.orderNo ? order.orderNo.replace(/^AZ-ORD-/, "") : "2026-000245"}`;

  return {
    invoiceNo,
    invoiceDate: formattedDate,
    orderId: order.orderNo || `AZ-ORD-${invoiceNo.replace("AZ-INV-", "")}`,
    orderDate: formattedDateTime,
    paymentMethod: order.transactionId ? "Stripe (Credit Card)" : "Cash on Delivery",
    paymentStatus: order.paymentStatus === "PAID" ? "Paid" : order.paymentStatus || "Paid",
    fulfillmentBy: "Multiple Sellers",
    billingAddress: {
      name: customer.name || "Akhi Islam",
      street: address.street || "House: 12, Road: 5, Block: B",
      cityStateZip: `${address.state || "Bashundhara R/A"}, ${address.postalCode ? `Dhaka ${address.postalCode}` : "Dhaka 1229"}`,
      country: address.country || "Bangladesh",
      phone: customer.phone || "+880 1712 345678",
      email: customer.email || "akhi.islam@email.com",
    },
    shippingAddress: {
      name: customer.name || "Akhi Islam",
      street: address.street || "House: 12, Road: 5, Block: B",
      cityStateZip: `${address.state || "Bashundhara R/A"}, ${address.postalCode ? `Dhaka ${address.postalCode}` : "Dhaka 1229"}`,
      country: address.country || "Bangladesh",
      phone: customer.phone || "+880 1712 345678",
    },
    items,
    subtotal,
    shippingFee,
    sellerHandlingFee,
    discount,
    grandTotal,
    currencySymbol: "৳",
  };
}

/**
 * Sample exact clone mock data (matches screenshot 100%)
 */
export const sampleCloneInvoiceData: IInvoiceData = {
  invoiceNo: "AZ-INV-2026-000245",
  invoiceDate: "12 August 2026",
  orderId: "AZ-ORD-2026-000245",
  orderDate: "12 August 2026, 10:24 AM",
  paymentMethod: "Stripe (Credit Card)",
  paymentStatus: "Paid",
  fulfillmentBy: "Multiple Sellers",
  billingAddress: {
    name: "Akhi Islam",
    street: "House: 12, Road: 5, Block: B",
    cityStateZip: "Bashundhara R/A, Dhaka 1229",
    country: "Bangladesh",
    phone: "+880 1712 345678",
    email: "akhi.islam@email.com",
  },
  shippingAddress: {
    name: "Akhi Islam",
    street: "House: 12, Road: 5, Block: B",
    cityStateZip: "Bashundhara R/A, Dhaka 1229",
    country: "Bangladesh",
    phone: "+880 1712 345678",
  },
  items: [
    {
      itemNo: 1,
      title: "boAt Rockerz 450 Pro Bluetooth Headphone",
      variantInfo: "Color: Black",
      sellerName: "Amarzone",
      fulfilledBy: "Fulfilled by Amarzone",
      asin: "AZH10001",
      sku: "BOAT-450PRO-BLK",
      price: 2199,
      quantity: 1,
      total: 2199,
    },
    {
      itemNo: 2,
      title: "Fire-Boltt Ninja Call Pro Smart Watch",
      variantInfo: "Color: Black",
      sellerName: "TechWorld BD",
      fulfilledBy: "Fulfilled by Seller",
      asin: "AZW20015",
      sku: "FB-NINJA-BLK",
      price: 2999,
      quantity: 1,
      total: 2999,
    },
    {
      itemNo: 3,
      title: "Baseus 20000mAh 22.5W Power Bank",
      variantInfo: "Color: Black",
      sellerName: "Gadget House",
      fulfilledBy: "Fulfilled by Seller",
      asin: "AZP30022",
      sku: "BASEUS-PB20K",
      price: 2490,
      quantity: 1,
      total: 2490,
    },
    {
      itemNo: 4,
      title: "Arctic Hunter Laptop Backpack",
      variantInfo: "Color: Grey",
      sellerName: "Amarzone",
      fulfilledBy: "Fulfilled by Amarzone",
      asin: "AZB40005",
      sku: "AH-BACKPACK-GRY",
      price: 1899,
      quantity: 1,
      total: 1899,
    },
  ],
  subtotal: 9587,
  shippingFee: 120,
  sellerHandlingFee: 60,
  discount: 700,
  grandTotal: 9067,
  grandTotalInWords: "(BDT Nine Thousand Sixty Seven Only)",
  currencySymbol: "৳",
};

/**
 * Uploads generated PDF buffer to Cloudinary in raw resource mode
 */
export const uploadPdfToCloudinary = (
  pdfBuffer: Buffer,
  fileName: string
): Promise<{ secure_url: string; public_id: string }> => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinaryUpload.uploader.upload_stream(
      {
        resource_type: "raw",
        folder: "amarzone/invoices",
        public_id: `${fileName}.pdf`,
        format: "pdf",
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error("Failed to upload PDF to Cloudinary"));
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );
    uploadStream.end(pdfBuffer);
  });
};

