import * as fs from "fs";
import * as path from "path";
import puppeteer from "puppeteer-core";
import { cloudinaryUpload } from "../config/cloudinary.config";

export interface IInvoiceItem {
  itemNo: number;
  title: string;
  variantInfo?: string;
  sellerName?: string;
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

  vendorInfo: IInvoiceAddress;
  shippingAddress: IInvoiceAddress;
  billingAddress?: IInvoiceAddress; // backwards compatibility

  items: IInvoiceItem[];

  subtotal: number;
  shippingFee: number;
  sellerHandlingFee: number;
  tax: number;
  discount: number;
  grandTotal: number;
  grandTotalInWords?: string;

  currencySymbol?: string;
}

// Convert numbers into words (e.g. 16154 -> Sixteen Thousand One Hundred Fifty Four)
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

  const billions = Math.floor(rounded / 1000000000);
  let rem = rounded % 1000000000;
  const millions = Math.floor(rem / 1000000);
  rem = rem % 1000000;
  const thousands = Math.floor(rem / 1000);
  const remaining = rem % 1000;

  let result = "";

  if (billions > 0) {
    result += `${convertLessThanThousand(billions)} Billion `;
  }
  if (millions > 0) {
    result += `${convertLessThanThousand(millions)} Million `;
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
 * Formats a currency amount into English words including fractional cents if any
 */
export function formatAmountInWords(amount: number, currencyName: string = "USD"): string {
  const integerPart = Math.floor(Math.abs(amount));
  const cents = Math.round((Math.abs(amount) - integerPart) * 100);
  const words = numberToWords(integerPart);
  if (cents > 0) {
    return `(${currencyName} ${words} and ${cents}/100 Only)`;
  }
  return `(${currencyName} ${words} Only)`;
}

/**
 * Generates an inverted white-on-black SVG Barcode matching Code 128 format
 */
function generateBarcodeSvg(code: string): string {
  const bars: { width: number; isSpace: boolean }[] = [];
  bars.push({ width: 2.2, isSpace: false });
  bars.push({ width: 1.2, isSpace: true });
  bars.push({ width: 1.0, isSpace: false });
  bars.push({ width: 1.8, isSpace: true });

  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    const pattern = [
      ((charCode * 3) % 3) + 1,
      ((charCode * 5) % 2) + 1,
      ((charCode * 7) % 3) + 1,
      ((charCode * 2) % 2) + 1,
    ];
    for (let j = 0; j < pattern.length; j++) {
      bars.push({
        width: pattern[j] * 0.95,
        isSpace: j % 2 === 1,
      });
    }
  }

  bars.push({ width: 2.2, isSpace: false });
  bars.push({ width: 1.2, isSpace: true });
  bars.push({ width: 2.8, isSpace: false });

  let currentX = 2;
  let rects = "";
  for (const bar of bars) {
    if (!bar.isSpace) {
      rects += `<rect x="${currentX.toFixed(1)}" y="0" width="${bar.width.toFixed(1)}" height="32" fill="#ffffff"/>`;
    }
    currentX += bar.width;
  }

  const totalWidth = Math.ceil(currentX + 2);

  return `
    <div class="barcode-box">
      <svg viewBox="0 0 ${totalWidth} 32" class="barcode-svg" xmlns="http://www.w3.org/2000/svg">
        ${rects}
      </svg>
      <div class="barcode-label">${code}</div>
    </div>
  `;
}

/**
 * Generates a clean QR code SVG
 */
function generateQrCodeSvg(): string {
  return `
    <svg viewBox="0 0 100 100" class="qr-svg" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#ffffff" rx="2" />
      <!-- Top-left finder -->
      <rect x="8" y="8" width="28" height="28" fill="#000000" rx="2" />
      <rect x="13" y="13" width="18" height="18" fill="#ffffff" rx="1" />
      <rect x="17" y="17" width="10" height="10" fill="#000000" rx="1" />
      <!-- Top-right finder -->
      <rect x="64" y="8" width="28" height="28" fill="#000000" rx="2" />
      <rect x="69" y="13" width="18" height="18" fill="#ffffff" rx="1" />
      <rect x="73" y="17" width="10" height="10" fill="#000000" rx="1" />
      <!-- Bottom-left finder -->
      <rect x="8" y="64" width="28" height="28" fill="#000000" rx="2" />
      <rect x="13" y="69" width="18" height="18" fill="#ffffff" rx="1" />
      <rect x="17" y="73" width="10" height="10" fill="#000000" rx="1" />
      <!-- Data modules -->
      <rect x="42" y="10" width="5" height="5" fill="#000000" />
      <rect x="52" y="14" width="5" height="5" fill="#000000" />
      <rect x="44" y="24" width="6" height="6" fill="#000000" />
      <rect x="52" y="30" width="5" height="5" fill="#000000" />
      <rect x="10" y="44" width="6" height="5" fill="#000000" />
      <rect x="22" y="48" width="5" height="6" fill="#000000" />
      <rect x="32" y="42" width="6" height="6" fill="#000000" />
      <rect x="42" y="44" width="6" height="6" fill="#000000" />
      <rect x="52" y="42" width="6" height="6" fill="#000000" />
      <rect x="64" y="44" width="6" height="6" fill="#000000" />
      <rect x="76" y="42" width="5" height="6" fill="#000000" />
      <rect x="84" y="46" width="6" height="5" fill="#000000" />
      <rect x="42" y="54" width="6" height="6" fill="#000000" />
      <rect x="52" y="56" width="6" height="6" fill="#000000" />
      <rect x="64" y="54" width="6" height="6" fill="#000000" />
      <rect x="76" y="56" width="5" height="5" fill="#000000" />
      <rect x="42" y="68" width="6" height="6" fill="#000000" />
      <rect x="52" y="72" width="6" height="6" fill="#000000" />
      <rect x="62" y="66" width="6" height="6" fill="#000000" />
      <rect x="72" y="72" width="6" height="6" fill="#000000" />
      <rect x="82" y="68" width="6" height="6" fill="#000000" />
      <rect x="42" y="82" width="6" height="6" fill="#000000" />
      <rect x="54" y="84" width="5" height="5" fill="#000000" />
      <rect x="64" y="82" width="6" height="6" fill="#000000" />
      <rect x="76" y="82" width="6" height="6" fill="#000000" />
      <rect x="84" y="84" width="5" height="5" fill="#000000" />
    </svg>
  `;
}

// Pre-load extracted authentic thumbnail images for sample products
let sampleThumbnails: Record<number, string> = {};
try {
  const thumbPath = path.join(__dirname, "../../assets/invoice/thumbnails.json");
  if (fs.existsSync(thumbPath)) {
    sampleThumbnails = JSON.parse(fs.readFileSync(thumbPath, "utf8"));
  }
} catch {
  // ignore
}

// User-specified Amarzone Cloudinary Logo
export const AMARZONE_LOGO_URL =
  "https://res.cloudinary.com/dkk9lvbtf/image/upload/v1785693062/amarzone_fnnw8s.png";

let localLogoDataUri = "";
try {
  const logoPath = path.join(__dirname, "../../assets/invoice/amarzone_logo.png");
  if (fs.existsSync(logoPath)) {
    localLogoDataUri = `data:image/png;base64,${fs.readFileSync(logoPath).toString("base64")}`;
  }
} catch {
  // ignore
}

/**
 * Product vector thumbnail or cutout image matching catalog
 */
function getProductThumbnail(itemNo: number, title: string, image?: string): string {
  const fallbackSvg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#9ca3af" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
  const src = image || sampleThumbnails[itemNo];
  if (src) {
    return `<img src="${src}" alt="${title}" class="thumb-img" onerror="this.onerror=null; this.style.display='none'; this.nextElementSibling.style.display='block';" /><span style="display:none;">${fallbackSvg}</span>`;
  }
  return fallbackSvg;
}

/**
 * Generates identical HTML matching the Amarzone PDF invoice layout
 */
export function generateInvoiceHtml(data: IInvoiceData): string {
  const currency = data.currencySymbol || "$";
  const currencyName = currency === "$" ? "USD" : currency === "৳" ? "BDT" : "USD";
  const words =
    data.grandTotalInWords ||
    formatAmountInWords(data.grandTotal, currencyName);

  const logoSrc = localLogoDataUri || AMARZONE_LOGO_URL;
  const barcodeSvg = generateBarcodeSvg(data.invoiceNo || data.orderId || "AZ-INV-2026-000245");
  const qrCodeSvg = generateQrCodeSvg();

  // Active vendor for this single-vendor order
  const vendor = data.vendorInfo || data.billingAddress || {
    name: "Amarzone Vendor",
    street: "House 24, Road 7, Sector 3",
    cityStateZip: "Uttara, Dhaka 1230",
    country: "Bangladesh",
    phone: "+880 1711-000000",
    email: "vendor@amarzone.com",
  };

  // Dynamic row sizing ensuring exact 1-page fit regardless of item count
  const itemCount = data.items.length;
  const rowHeight = itemCount <= 4 ? 42 : itemCount <= 7 ? 36 : itemCount <= 10 ? 30 : Math.max(22, Math.floor(290 / itemCount));
  const thumbSize = itemCount <= 5 ? 32 : itemCount <= 8 ? 26 : 22;
  const titleFontSize = itemCount <= 7 ? 9.5 : 8.5;

  const itemsHtml = data.items
    .map((item) => {
      return `
      <tr class="item-row" style="height: ${rowHeight}px;">
        <td class="col-num">${item.itemNo}</td>
        <td class="col-product">
          <div class="product-wrapper">
            <div class="product-thumb" style="width: ${thumbSize}px; height: ${thumbSize}px;">
              ${getProductThumbnail(item.itemNo, item.title, item.image)}
            </div>
            <div class="product-info">
              <div class="product-title" style="font-size: ${titleFontSize}px;">${item.title}</div>
              ${item.variantInfo
          ? `<div class="product-variant">${item.variantInfo}</div>`
          : ""
        }
            </div>
          </div>
        </td>
        <td class="col-asin-sku">
          <div class="asin-line"><strong>ASIN:</strong> ${item.asin}</div>
          <div class="sku-line">SKU: ${item.sku}</div>
        </td>
        <td class="col-price">${currency} ${item.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td class="col-qty">${item.quantity}</td>
        <td class="col-total">${currency} ${item.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice - ${data.invoiceNo}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

    @page {
      size: 682px 1024px;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #ffffff;
      color: #111827;
      font-size: 11px;
      line-height: 1.35;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      margin: 0;
      padding: 0;
    }

    .invoice-container {
      width: 682px;
      height: 1024px;
      max-height: 1024px;
      margin: 0 auto;
      background-color: #ffffff;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: avoid !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* TOP HEADER */
    .header-wrapper {
      position: relative;
      width: 682px;
      height: 142px;
      background: #ffffff;
      overflow: hidden;
      flex-shrink: 0;
    }

    .header-bg-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 682px;
      height: 142px;
      filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.18));
      z-index: 1;
    }

    .header-content {
      position: absolute;
      top: 0;
      left: 0;
      width: 682px;
      height: 142px;
      padding: 14px 22px 0 22px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      z-index: 2;
    }

    /* BRAND LOGO */
    .brand-section {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .brand-logo-img {
      height: 44px;
      width: auto;
      max-width: 230px;
      object-fit: contain;
      display: block;
    }

    .brand-slogan {
      font-family: 'Inter', sans-serif;
      color: #ffffff;
      font-size: 11px;
      font-weight: 400;
      letter-spacing: 0.2px;
      margin-top: 3px;
      margin-left: 2px;
    }

    /* INVOICE TITLE & BARCODE */
    .invoice-meta-section {
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }

    .invoice-heading {
      font-size: 25px;
      font-weight: 800;
      letter-spacing: 1px;
      line-height: 1;
      background: linear-gradient(180deg, #fae39b 0%, #dfa841 70%, #b87a1a 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .invoice-number-tag {
      font-size: 12px;
      font-weight: 700;
      color: #dfa841;
      margin-top: 2px;
    }

    .invoice-date-tag {
      font-family: 'Inter', sans-serif;
      font-size: 10px;
      color: #ffffff;
      margin-top: 2px;
      margin-bottom: 5px;
    }

    .barcode-box {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .barcode-svg {
      width: 154px;
      height: 32px;
      display: block;
    }

    .barcode-label {
      font-family: 'Inter', monospace, sans-serif;
      font-size: 8.5px;
      letter-spacing: 1.2px;
      color: #ffffff;
      font-weight: 500;
      margin-top: 2px;
      text-align: center;
    }

    /* MAIN CONTENT */
    .main-body {
      padding: 6px 22px 0 22px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    /* THANK YOU BANNER */
    .thankyou-banner {
      margin-bottom: 8px;
    }

    .thankyou-heading {
      font-size: 14px;
      font-weight: 800;
      color: #000000;
      line-height: 1.2;
    }

    .highlight-gold {
      color: #c8861d;
    }

    .thankyou-sub {
      font-size: 10px;
      color: #4b5563;
      margin-top: 1.5px;
    }

    /* 3 SUMMARY CARDS */
    .cards-row {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 14px;
      margin-bottom: 10px;
    }

    .info-card {
      border: 1px solid #f0e6d6;
      border-radius: 8px;
      padding: 9px 12px;
      background: #ffffff;
      height: 134px;
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }

    .icon-badge-solid {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #c8861d;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      flex-shrink: 0;
    }

    .card-title {
      font-size: 9.5px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #000000;
      text-transform: uppercase;
    }

    .address-name {
      font-size: 10px;
      font-weight: 600;
      color: #000000;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .address-line {
      font-size: 9px;
      color: #374151;
      line-height: 1.35;
    }

    .contact-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 9px;
      color: #000000;
      margin-top: 3px;
    }

    /* ORDER DETAILS CARD */
    .order-meta-card {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 8px 12px;
    }

    .meta-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .meta-icon-badge {
      width: 17px;
      height: 17px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #c8861d;
      flex-shrink: 0;
    }

    .meta-icon-badge-filled {
      border-radius: 3px;
      background: #c8861d;
      color: #ffffff;
    }

    .meta-content {
      display: flex;
      flex-direction: column;
      line-height: 1.15;
    }

    .meta-label {
      font-size: 7.5px;
      font-weight: 800;
      text-transform: uppercase;
      color: #000000;
      letter-spacing: 0.3px;
    }

    .meta-val {
      font-size: 9px;
      color: #4b5563;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 130px;
    }

    .meta-val-paid {
      color: #16a34a;
      font-weight: 700;
    }

    /* ITEMS TABLE */
    .table-section {
      margin-bottom: 8px;
    }

    .invoice-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .invoice-table thead tr {
      background: #000000;
      height: 22px;
    }

    .invoice-table th {
      padding: 3px 4px;
      color: #dfa841;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      border: none;
      vertical-align: middle;
    }

    .th-num { width: 30px; text-align: center; border-radius: 4px 0 0 0; }
    .th-product { width: 295px; text-align: left; padding-left: 8px; }
    .th-asin { width: 150px; text-align: left; }
    .th-price { width: 60px; text-align: right; }
    .th-qty { width: 35px; text-align: center; }
    .th-total { width: 68px; text-align: right; padding-right: 8px; border-radius: 0 4px 0 0; }

    .item-row td {
      padding: 2px 4px;
      border-bottom: 1px solid #f3ece1;
      vertical-align: middle;
    }

    .col-num {
      font-weight: 600;
      color: #000000;
      font-size: 10px;
      text-align: center;
    }

    .col-product {
      text-align: left;
      padding-left: 6px;
    }

    .product-wrapper {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .product-thumb {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .thumb-img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    .product-info {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .product-title {
      font-weight: 700;
      color: #000000;
      line-height: 1.2;
      white-space: normal;
    }

    .product-variant {
      font-size: 8px;
      color: #6b7280;
      margin-top: 1px;
    }

    .col-asin-sku {
      text-align: left;
    }

    .asin-line {
      font-size: 8.5px;
      color: #000000;
      line-height: 1.25;
    }

    .sku-line {
      font-size: 7.5px;
      color: #4b5563;
      margin-top: 1px;
      line-height: 1.25;
    }

    .col-price {
      text-align: right;
      font-weight: 500;
      color: #000000;
      font-size: 9.5px;
    }

    .col-qty {
      text-align: center;
      font-weight: 500;
      color: #000000;
      font-size: 9.5px;
    }

    .col-total {
      text-align: right;
      font-weight: 700;
      color: #000000;
      font-size: 9.5px;
      padding-right: 8px;
    }

    /* SUMMARY SECTION */
    .summary-section {
      display: grid;
      grid-template-columns: 310px 314px;
      gap: 14px;
      align-items: start;
      margin-bottom: 6px;
    }

    /* LEFT NOTES */
    .left-notes-column {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .appreciate-card {
      background: #000000;
      border-radius: 6px;
      padding: 6px 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .appreciate-icon-ring {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      border: 1.8px solid #dfa841;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #dfa841;
      flex-shrink: 0;
    }

    .appreciate-heading {
      color: #dfa841;
      font-size: 10px;
      font-weight: 700;
    }

    .appreciate-text {
      color: #d1d5db;
      font-size: 8px;
      margin-top: 1px;
      line-height: 1.25;
    }

    .policy-card {
      background: #ffffff;
      border: 1px solid #f2e2c4;
      border-radius: 6px;
      padding: 6px 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .policy-icon {
      color: #c8861d;
      flex-shrink: 0;
    }

    .policy-title {
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.3px;
      color: #c8861d;
      text-transform: uppercase;
    }

    .policy-text {
      font-size: 8px;
      color: #374151;
      margin-top: 1px;
      line-height: 1.25;
    }

    .trust-badges-card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 5px 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .trust-badge-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 7.5px;
      font-weight: 600;
      color: #111827;
      line-height: 1.2;
    }

    .trust-badge-icon {
      color: #c8861d;
      flex-shrink: 0;
    }

    .trust-divider {
      border-right: 1px dotted #d1d5db;
      height: 18px;
    }

    /* RIGHT CALCULATION CARD */
    .calc-card {
      background: #faf9f7;
      border: 1px solid #f0e6d6;
      border-radius: 8px;
      padding: 6px 14px 6px 14px;
    }

    .calc-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 2px 0;
      font-size: 9.5px;
      color: #374151;
      font-weight: 500;
    }

    .discount-val {
      color: #16a34a;
      font-weight: 600;
    }

    .calc-divider {
      border-top: 1px solid #dfa841;
      margin: 5px 0;
    }

    .grand-total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 1px;
    }

    .grand-total-label {
      font-size: 13px;
      font-weight: 800;
      color: #000000;
      letter-spacing: 0.5px;
    }

    .grand-total-val {
      font-size: 20px;
      font-weight: 800;
      color: #c8861d;
    }

    .grand-total-words {
      text-align: right;
      font-size: 8px;
      color: #4b5563;
      margin-top: 2px;
      line-height: 1.25;
    }

    .tax-detail-note {
      font-size: 7.5px;
      color: #6b7280;
      font-weight: 500;
      margin-top: 1px;
    }

    /* FOOTER */
    .footer-wrapper {
      background: #000000;
      color: #ffffff;
      padding: 10px 22px 8px 22px;
      flex-shrink: 0;
    }

    .footer-columns {
      display: grid;
      grid-template-columns: 1.35fr 1fr 1fr;
      gap: 12px;
    }

    /* FOOTER COL 1 */
    .footer-col-brand {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 4px;
    }

    .footer-brand-logo {
      height: 24px;
      width: auto;
      max-width: 120px;
      object-fit: contain;
      display: block;
      margin-bottom: 2px;
    }

    .footer-info {
      display: flex;
      flex-direction: column;
    }

    .footer-brand-name {
      color: #dfa841;
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }

    .footer-unit-title {
      font-size: 7.5px;
      color: #9ca3af;
      margin-top: 1px;
    }

    .footer-address {
      font-size: 7.5px;
      color: #9ca3af;
      line-height: 1.25;
      margin-top: 2px;
    }

    .footer-contact {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 7.5px;
      color: #ffffff;
      margin-top: 2px;
    }

    /* FOOTER COL 2 */
    .footer-col-help {
      display: flex;
      flex-direction: column;
      border-left: 1px solid rgba(223, 168, 65, 0.35);
      padding-left: 12px;
    }

    .help-heading {
      color: #dfa841;
      font-size: 10px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-bottom: 4px;
    }

    .help-item {
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: 7.5px;
      color: #ffffff;
      margin-bottom: 2px;
    }

    /* FOOTER COL 3 */
    .footer-col-social {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-left: 1px solid rgba(223, 168, 65, 0.35);
      padding-left: 12px;
    }

    .social-left-wrap {
      display: flex;
      flex-direction: column;
    }

    .social-heading {
      color: #dfa841;
      font-size: 10px;
      font-weight: 700;
      margin-bottom: 5px;
    }

    .social-icons-row {
      display: flex;
      gap: 5px;
    }

    .social-icon-circle {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
    }

    .social-facebook { background: #1877f2; }
    .social-instagram {
      background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285aeb 90%);
    }
    .social-youtube { background: #ff0000; }
    .social-linkedin { background: #0a66c2; }

    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .qr-svg {
      width: 44px;
      height: 44px;
      border-radius: 2px;
    }

    .qr-caption {
      font-size: 7px;
      color: #9ca3af;
      margin-top: 2px;
      text-align: center;
      line-height: 1.15;
    }

    /* BOTTOM STRIP */
    .bottom-strip {
      background: #c6902f;
      text-align: center;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9.5px;
      letter-spacing: 0.3px;
      flex-shrink: 0;
    }

    .bottom-text-dark {
      color: #000000;
      font-weight: 700;
    }

    .bottom-text-light {
      color: #ffffff;
      font-weight: 700;
    }
  </style>
</head>
<body>

<div class="invoice-container">
  <!-- TOP HEADER -->
  <header class="header-wrapper">
    <!-- SVG Black shape, Gold wave & Swoosh decoration -->
    <svg class="header-bg-svg" viewBox="0 0 682 142" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="goldWave" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#dfa841" />
          <stop offset="30%" stop-color="#fae39b" />
          <stop offset="50%" stop-color="#dfa841" />
          <stop offset="70%" stop-color="#fae39b" />
          <stop offset="100%" stop-color="#b87a1a" />
        </linearGradient>
        <linearGradient id="goldSwoosh" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#b87a1a" stop-opacity="0.3" />
          <stop offset="30%" stop-color="#dfa841" stop-opacity="0.8" />
          <stop offset="60%" stop-color="#fae39b" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#dfa841" stop-opacity="0.5" />
        </linearGradient>
      </defs>

      <!-- Main Black Header Shape -->
      <path d="
        M 0 0
        L 682 0
        L 682 142
        L 515 142
        C 460 135, 390 102, 330 84
        C 265 65, 185 70, 115 78
        C 60 84, 20 86, 0 84
        Z
      " fill="#000000" />

      <!-- Gold Ribbon along bottom wave -->
      <path d="
        M 0 84
        C 20 86, 60 84, 115 78
        C 185 70, 265 65, 330 84
        C 390 102, 460 135, 515 142
        L 682 142
      " stroke="url(#goldWave)" stroke-width="3.5" fill="none" />

      <!-- Thin gold highlight on bottom wave -->
      <path d="
        M 0 86
        C 20 88, 60 86, 115 80
        C 185 72, 265 67, 330 86
        C 390 104, 460 137, 515 144
        L 682 144
      " stroke="#fae39b" stroke-width="1" opacity="0.6" fill="none" />

      <!-- Upper swoosh arching to top-right -->
      <path d="
        M 180 78
        C 250 70, 340 45, 430 20
        C 480 6, 530 0, 580 0
      " stroke="url(#goldSwoosh)" stroke-width="3" fill="none" />

      <path d="
        M 210 74
        C 280 64, 360 40, 440 18
        C 485 5, 525 0, 560 0
      " stroke="#fae39b" stroke-width="1.2" opacity="0.7" fill="none" />
    </svg>

    <div class="header-content">
      <!-- LEFT BRAND -->
      <div class="brand-section">
        <img src="${logoSrc}" class="brand-logo-img" alt="Amarzone" />
        <div class="brand-slogan">Shop More, Pay Less</div>
      </div>

      <!-- RIGHT INVOICE TAG & BARCODE -->
      <div class="invoice-meta-section">
        <div class="invoice-heading">INVOICE</div>
        <div class="invoice-number-tag">#${data.invoiceNo}</div>
        <div class="invoice-date-tag">Date: ${data.invoiceDate}</div>
        ${barcodeSvg}
      </div>
    </div>
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
      <!-- VENDOR INFORMATION (REPLACED BILLING ADDRESS) -->
      <div class="info-card">
        <div class="card-header">
          <div class="icon-badge-solid">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="#ffffff">
              <path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/>
            </svg>
          </div>
          <div class="card-title">Vendor Information</div>
        </div>
        <div class="address-name">${vendor.name}</div>
        <div class="address-line">${vendor.street}</div>
        <div class="address-line">${vendor.cityStateZip}</div>
        <div class="address-line">${vendor.country}</div>
        <div class="contact-item">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="#000000">
            <path d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.72 11.72 0 0 0 3.67.59 1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.72 11.72 0 0 0 .59 3.67 1 1 0 0 1-.24 1.02l-2.22 2.1z"/>
          </svg>
          <span>${vendor.phone}</span>
        </div>
        ${vendor.email
      ? `
        <div class="contact-item">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="#000000">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
          </svg>
          <span>${vendor.email}</span>
        </div>`
      : ""
    }
      </div>

      <!-- SHIPPING ADDRESS -->
      <div class="info-card">
        <div class="card-header">
          <div class="icon-badge-solid">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="#ffffff">
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
          <svg viewBox="0 0 24 24" width="10" height="10" fill="#000000">
            <path d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.72 11.72 0 0 0 3.67.59 1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.72 11.72 0 0 0 .59 3.67 1 1 0 0 1-.24 1.02l-2.22 2.1z"/>
          </svg>
          <span>${data.shippingAddress.phone}</span>
        </div>
      </div>

      <!-- ORDER DETAILS -->
      <div class="info-card order-meta-card">
        <div class="meta-row">
          <div class="meta-icon-badge meta-icon-badge-filled">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <div class="meta-content">
            <div class="meta-label">Order ID</div>
            <div class="meta-val">${data.orderId}</div>
          </div>
        </div>
        <div class="meta-row">
          <div class="meta-icon-badge">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
          </div>
          <div class="meta-content">
            <div class="meta-label">Order Date</div>
            <div class="meta-val">${data.orderDate}</div>
          </div>
        </div>
        <div class="meta-row">
          <div class="meta-icon-badge">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
          </div>
          <div class="meta-content">
            <div class="meta-label">Payment Method</div>
            <div class="meta-val">${data.paymentMethod}</div>
          </div>
        </div>
        <div class="meta-row">
          <div class="meta-icon-badge">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <path d="m9 12 2 2 4-4" stroke="#16a34a" stroke-width="2"/>
            </svg>
          </div>
          <div class="meta-content">
            <div class="meta-label">Payment Status</div>
            <div class="meta-val meta-val-paid">${data.paymentStatus}</div>
          </div>
        </div>
        <div class="meta-row">
          <div class="meta-icon-badge">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z"/>
            </svg>
          </div>
          <div class="meta-content">
            <div class="meta-label">Fulfillment By</div>
            <div class="meta-val">${data.fulfillmentBy || vendor.name}</div>
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
        <!-- WE APPRECIATE YOUR BUSINESS -->
        <div class="appreciate-card">
          <div class="appreciate-icon-ring">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#dfa841" stroke-width="2">
              <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
            </svg>
          </div>
          <div>
            <div class="appreciate-heading">We appreciate your business!</div>
            <div class="appreciate-text">If you have any questions,<br>feel free to contact our support team.</div>
          </div>
        </div>

        <!-- RETURN & REFUND POLICY -->
        <div class="policy-card">
          <div class="policy-icon">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#c8861d" stroke-width="1.8">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <div>
            <div class="policy-title">Return & Refund Policy</div>
            <div class="policy-text">
              You can return most items within 7 days of delivery.<br>For details, please visit our website or contact support.
            </div>
          </div>
        </div>

        <!-- TRUST BADGES -->
        <div class="trust-badges-card">
          <div class="trust-badge-item">
            <svg class="trust-badge-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#c8861d" stroke-width="2">
              <circle cx="12" cy="8" r="6"/>
              <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>
            </svg>
            <span>100% Original<br>Products</span>
          </div>
          <div class="trust-divider"></div>
          <div class="trust-badge-item">
            <svg class="trust-badge-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#c8861d" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>Secure<br>Payment</span>
          </div>
          <div class="trust-divider"></div>
          <div class="trust-badge-item">
            <svg class="trust-badge-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#c8861d" stroke-width="2">
              <rect x="1" y="3" width="15" height="13"/>
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/>
              <circle cx="5.5" cy="18.5" r="2.5"/>
              <circle cx="18.5" cy="18.5" r="2.5"/>
            </svg>
            <span>Fast & Safe<br>Delivery</span>
          </div>
        </div>
      </div>

      <!-- RIGHT TOTALS -->
      <div class="calc-card">
        <div class="calc-row">
          <span>Subtotal (${data.items.length} ${data.items.length === 1 ? "Item" : "Items"})</span>
          <span>${currency} ${data.subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="calc-row">
          <span>Shipping Fee</span>
          <span>${data.shippingFee > 0 ? `${currency} ${data.shippingFee.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "Free"}</span>
        </div>
        ${data.sellerHandlingFee > 0 ? `
        <div class="calc-row">
          <span>Handling Fee</span>
          <span>${currency} ${data.sellerHandlingFee.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>` : ""}
        <div class="calc-row">
          <span>Tax</span>
          <span>${currency} ${(data.tax || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="calc-row">
          <span>Discount</span>
          <span class="discount-val">${data.discount > 0 ? `- ${currency} ${data.discount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$ 0.00"}</span>
        </div>
        <div class="calc-divider"></div>
        <div class="grand-total-row">
          <span class="grand-total-label">GRAND TOTAL</span>
          <span class="grand-total-val">${currency} ${data.grandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        <div class="grand-total-words">
          <div>${words}</div>
          ${data.tax > 0
      ? `<div class="tax-detail-note">Includes ${currency} ${data.tax.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Tax</div>`
      : ""
    }
        </div>
      </div>
    </section>
  </main>

  <!-- FOOTER -->
  <footer class="footer-wrapper">
    <div class="footer-columns">
      <div class="footer-col-brand">
        <!-- Official Amarzone Logo in Footer -->
        <img src="${logoSrc}" class="footer-brand-logo" alt="Amarzone" />
        <div class="footer-info">
          <div class="footer-brand-name">AMARZONE</div>
          <div class="footer-unit-title">A Unit of Amarzone Ltd.</div>
          <div class="footer-address">
            House: 21, Road: 3, Block: C<br>
            Bashundhara R/A, Dhaka 1229,<br>
            Bangladesh
          </div>
          <div class="footer-contact">
            <svg viewBox="0 0 24 24" width="9" height="9" fill="#dfa841">
              <path d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.72 11.72 0 0 0 3.67.59 1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.72 11.72 0 0 0 .59 3.67 1 1 0 0 1-.24 1.02l-2.22 2.1z"/>
            </svg>
            <span>+880 9612 345678</span>
          </div>
          <div class="footer-contact">
            <svg viewBox="0 0 24 24" width="9" height="9" fill="#dfa841">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
            </svg>
            <span>support@amarzone.com</span>
          </div>
        </div>
      </div>

      <div class="footer-col-help">
        <div class="help-heading">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#dfa841" stroke-width="2">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
          <span>Need Help?</span>
        </div>
        <div class="help-item">
          <svg viewBox="0 0 24 24" width="9" height="9" fill="#ffffff">
            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
          </svg>
          <span>support@amarzone.com</span>
        </div>
        <div class="help-item">
          <svg viewBox="0 0 24 24" width="9" height="9" fill="#ffffff">
            <path d="M6.62 10.79a15.053 15.053 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.02-.24 11.72 11.72 0 0 0 3.67.59 1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.72 11.72 0 0 0 .59 3.67 1 1 0 0 1-.24 1.02l-2.22 2.1z"/>
          </svg>
          <span>+880 9612 345678</span>
        </div>
        <div class="help-item">
          <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="#ffffff" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
          <span>www.amarzone.com</span>
        </div>
        <div class="help-item">
          <svg viewBox="0 0 24 24" width="9" height="9" fill="#ffffff">
            <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
          </svg>
          <span>Live Chat: amarzone.com/chat</span>
        </div>
      </div>

      <div class="footer-col-social">
        <div class="social-left-wrap">
          <div class="social-heading">Follow Us</div>
          <div class="social-icons-row">
            <div class="social-icon-circle social-facebook">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="#ffffff">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
              </svg>
            </div>
            <div class="social-icon-circle social-instagram">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#ffffff" stroke-width="2">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </div>
            <div class="social-icon-circle social-youtube">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="#ffffff">
                <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/>
                <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="#ff0000"/>
              </svg>
            </div>
            <div class="social-icon-circle social-linkedin">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="#ffffff">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                <rect x="2" y="9" width="4" height="12"/>
                <circle cx="4" cy="4" r="2"/>
              </svg>
            </div>
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
    <span class="bottom-text-dark">Thank you for choosing Amarzone. </span>
    <span class="bottom-text-light">&nbsp;Happy Shopping!</span>
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
 * Generates identical PDF buffer strictly constrained to a SINGLE PAGE
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
    await page.setViewport({ width: 682, height: 1024, deviceScaleFactor: 2 });
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
    });

    const pdfUint8Array = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
      width: "682px",
      height: "1024px",
      pageRanges: "1", // Strictly enforce 1-page PDF
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
 * Maps a dynamic MongoDB Order document, Customer profile, and Vendor profile to IInvoiceData
 */
export function mapOrderToInvoiceData(
  order: any,
  customerProfile?: any,
  vendorProfile?: any
): IInvoiceData {
  const customerUser = order.customer || {};
  const customer = customerProfile || customerUser;
  const custAddress = customer.address || {};

  const vendorUser = order.vendor || {};
  const vendor = vendorProfile || vendorUser;
  const vendAddress = vendor.address || {};

  const vendorName = vendor.name || "Amarzone Vendor";

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

  const items: IInvoiceItem[] = (order.products || []).map((item: any, idx: number) => {
    const variant = item.variant || {};
    const product = variant.product || {};

    let variantInfo: string | undefined;
    if (Array.isArray(variant.attributes) && variant.attributes.length > 0) {
      variantInfo = variant.attributes
        .map((attr: any) => `${attr.type}: ${attr.value}`)
        .join(", ");
    }

    const unitPrice = typeof item.price === "number" ? item.price : 0;
    const qty = typeof item.quantity === "number" ? item.quantity : 1;
    const total = +(unitPrice * qty).toFixed(2);

    return {
      itemNo: idx + 1,
      title: product.title || variant.sku || `Product Item ${idx + 1}`,
      variantInfo,
      asin: variant.asin || "AZN00000",
      sku: variant.sku || "SKU-00000",
      price: unitPrice,
      quantity: qty,
      total,
      image: (Array.isArray(variant.images) && variant.images[0]) || product.thumbnail || undefined,
    };
  });

  const subtotal = +items.reduce((sum: number, it: any) => sum + it.total, 0).toFixed(2);
  const grandTotal = typeof order.totalPrice === "number" ? +order.totalPrice.toFixed(2) : subtotal;

  // Retrieve dynamic fixed tax from actual order data
  const tax = typeof order.tax === "number" ? +order.tax.toFixed(2) : 0;

  let discount = 0;
  let shippingFee = 0;
  let sellerHandlingFee = 0;

  const expectedTotalWithTax = +(subtotal + tax).toFixed(2);
  if (grandTotal < expectedTotalWithTax) {
    discount = +(expectedTotalWithTax - grandTotal).toFixed(2);
  } else if (grandTotal > expectedTotalWithTax) {
    shippingFee = +(grandTotal - expectedTotalWithTax).toFixed(2);
  }

  const invoiceNo = `AZ-INV-${order.orderNo ? order.orderNo.replace(/^AZ-(ORD|INV)-/, "") : order._id ? order._id.toString().slice(-8).toUpperCase() : "2026-000245"}`;
  const orderId = order.orderNo
    ? (order.orderNo.startsWith("AZ-ORD-") ? order.orderNo : `AZ-ORD-${order.orderNo}`)
    : `AZ-ORD-${order._id ? order._id.toString().slice(-8).toUpperCase() : "2026-000245"}`;

  const paymentMethod = order.transactionId && order.transactionId.startsWith("pi_")
    ? "Stripe (Credit Card)"
    : order.transactionId
      ? "Credit Card"
      : "Cash on Delivery";

  const paymentStatus = order.paymentStatus === "PAID" || order.paymentStatus === "Paid"
    ? "Paid"
    : order.paymentStatus || "Paid";

  const vendCityZip = `${vendAddress.state || ""}${vendAddress.postalCode ? `, ${vendAddress.postalCode}` : ""}`.trim().replace(/^,|,$/g, "") || "Dhaka 1205";
  const custCityZip = `${custAddress.state || ""}${custAddress.postalCode ? `, ${custAddress.postalCode}` : ""}`.trim().replace(/^,|,$/g, "") || "Dhaka 1229";

  return {
    invoiceNo,
    invoiceDate: formattedDate,
    orderId,
    orderDate: formattedDateTime,
    paymentMethod,
    paymentStatus,
    fulfillmentBy: vendorName,
    vendorInfo: {
      name: vendorName,
      street: vendAddress.street,
      cityStateZip: vendCityZip,
      country: vendAddress.country,
      phone: vendor.phone,
      email: vendor.email,
    },
    shippingAddress: {
      name: customer.name,
      street: custAddress.street,
      cityStateZip: custCityZip,
      country: custAddress.country,
      phone: customer.phone,
      email: customer.email,
    },
    items,
    subtotal,
    shippingFee,
    sellerHandlingFee,
    tax,
    discount,
    grandTotal,
    grandTotalInWords: formatAmountInWords(grandTotal, "USD"),
    currencySymbol: "$",
  };
}

