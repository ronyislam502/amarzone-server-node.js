import mongoose from "mongoose";
import { SlaViolation } from "./violation.model";
import { User } from "../user/user.model";
import sendEmail from "../../utilities/sendEmail";
import {
  emitVendorWarning,
  emitVendorSuspended,
  emitViolationResolved,
} from "../../socket/socketViolation";
import QueryBuilder from "../../builder/queryBuilder";

const SLA_CONFIG = {
  "Order Defect Rate": {
    checkViolation: (val: number) => val >= 1.0,
    checkSuspension: (val: number) => val >= 5.0,
    allowed: "< 1.0%",
    explanation: "Your Order Defect Rate (ODR) is higher than the allowed threshold. ODR is calculated as the percentage of orders with defects (cancellations, refunds, low ratings).",
    recommendation: "Please focus on customer service, ensuring orders are delivered without damage, and customer complaints/refunds are minimized.",
  },
  "Late Shipment Rate": {
    checkViolation: (val: number) => val >= 4.0,
    checkSuspension: (val: number) => val >= 10.0,
    allowed: "< 4.0%",
    explanation: "Your Late Shipment Rate (LSR) has exceeded the acceptable limit. LSR is the percentage of orders shipped after the expected ship date.",
    recommendation: "Ensure you ship all orders on or before the expected shipping date. Update shipping carrier tracking numbers promptly.",
  },
  "Cancellation Rate": {
    checkViolation: (val: number) => val >= 2.5,
    checkSuspension: (val: number) => val >= 5.0,
    allowed: "< 2.5%",
    explanation: "Your Cancellation Rate is above the required threshold. Cancellation Rate measures vendor-initiated cancellations prior to shipment.",
    recommendation: "Maintain accurate inventory levels in your product catalog to prevent cancelling orders due to stock issues.",
  },
  "Valid Tracking Rate": {
    checkViolation: (val: number) => val < 95.0,
    checkSuspension: (val: number) => val < 80.0,
    allowed: ">= 95.0%",
    explanation: "Your Valid Tracking Rate (VTR) is below the required standard. VTR measures the percentage of shipped orders that include a valid courier and tracking number.",
    recommendation: "Always input the correct tracking number and select the correct courier service when marking orders as shipped.",
  },
};

const evaluateSla = async (
  vendorId: string,
  metrics: {
    orderDefectRate: number;
    lateShipmentRate: number;
    cancellationRate: number;
    validTrackingRate: number;
  },
  session?: mongoose.ClientSession
) => {
  const vendor = await User.findById(vendorId).session(session || null);
  if (!vendor) return;

  const emailAddress = vendor.email;

  const evaluations = [
    { name: "Order Defect Rate", val: metrics.orderDefectRate },
    { name: "Late Shipment Rate", val: metrics.lateShipmentRate },
    { name: "Cancellation Rate", val: metrics.cancellationRate },
    { name: "Valid Tracking Rate", val: metrics.validTrackingRate },
  ];

  for (const evalItem of evaluations) {
    const config = SLA_CONFIG[evalItem.name as keyof typeof SLA_CONFIG];
    const isViolated = config.checkViolation(evalItem.val);

    if (isViolated) {
      const isSuspended = config.checkSuspension(evalItem.val);
      const severity: "Warning" | "Suspension" = isSuspended ? "Suspension" : "Warning";

      const existing = await SlaViolation.findOne({
        vendor: vendorId,
        metric: evalItem.name,
        isResolved: false,
      }).session(session || null);

      if (!existing) {
        // Create new violation
        const [newViolation] = await SlaViolation.create(
          [
            {
              vendor: vendorId,
              metric: evalItem.name,
              actualValue: evalItem.val,
              severity,
              isResolved: false,
            },
          ],
          { session }
        );

        // Send Email & Emit Socket
        if (severity === "Warning") {
          sendWarningEmail(emailAddress, evalItem.name, evalItem.val, config.allowed, config.explanation, config.recommendation);
          emitVendorWarning(vendorId, newViolation);
        } else {
          sendSuspensionEmail(emailAddress, evalItem.name, evalItem.val, config.allowed, config.explanation, config.recommendation);
          emitVendorSuspended(vendorId, newViolation);
        }
      } else {
        // Unresolved violation already exists
        const oldSeverity = existing.severity;
        if (oldSeverity !== severity) {
          existing.severity = severity;
          existing.actualValue = evalItem.val;
          await existing.save({ session });

          // Send Email & Socket if severity escalated
          if (severity === "Suspension" && oldSeverity === "Warning") {
            sendSuspensionEmail(emailAddress, evalItem.name, evalItem.val, config.allowed, config.explanation, config.recommendation);
            emitVendorSuspended(vendorId, existing);
          } else if (severity === "Warning" && oldSeverity === "Suspension") {
            // De-escalated, warning emit/email optionally triggerable
            emitVendorWarning(vendorId, existing);
          }
        } else {
          // Just update value
          existing.actualValue = evalItem.val;
          await existing.save({ session });
        }
      }
    } else {
      const existing = await SlaViolation.findOne({
        vendor: vendorId,
        metric: evalItem.name,
        isResolved: false,
      }).session(session || null);

      if (existing) {
        existing.isResolved = true;
        await existing.save({ session });

        // Emit Socket Resolution
        emitViolationResolved(vendorId, existing);
      }
    }
  }
};

const sendWarningEmail = (
  email: string,
  metric: string,
  val: number,
  allowed: string,
  explanation: string,
  recommendation: string
) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 5px;">
      <h2 style="color: #d9534f; margin-top: 0;">SLA Violation Warning Notification</h2>
      <p>Dear Vendor,</p>
      <p>We are writing to inform you that your account performance metrics have violated our SLA requirements.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f9f9f9;">
          <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Violated Metric</th>
          <td style="padding: 8px; border: 1px solid #ddd;">${metric}</td>
        </tr>
        <tr>
          <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Current Value</th>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #d9534f;">${val}%</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Allowed Threshold</th>
          <td style="padding: 8px; border: 1px solid #ddd;">${allowed}</td>
        </tr>
      </table>
      <p><strong>Problem Explanation:</strong> ${explanation}</p>
      <p><strong>Recommendation to Improve:</strong> ${recommendation}</p>
      <p>Please take immediate actions to improve your performance to avoid further penalties or account suspension.</p>
      <p>Sincerely,<br/>Amarzone Partner Support Team</p>
    </div>
  `;

  sendEmail(email, html, `SLA Violation Warning: ${metric}`).catch((err) => {
    console.error(`[SLA Warning Email] Failed to send to ${email}:`, err);
  });
};

const sendSuspensionEmail = (
  email: string,
  metric: string,
  val: number,
  allowed: string,
  explanation: string,
  recommendation: string
) => {
  const html = `
    <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 5px;">
      <h2 style="color: #d9534f; margin-top: 0;">SLA Violation Account Suspension Notification</h2>
      <p>Dear Vendor,</p>
      <p>We regret to inform you that your vendor account has been suspended because your performance metrics have severely violated our SLA requirements and thresholds.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr style="background-color: #f9f9f9;">
          <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Violated Metric</th>
          <td style="padding: 8px; border: 1px solid #ddd;">${metric}</td>
        </tr>
        <tr>
          <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Current Value</th>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: #d9534f;">${val}%</td>
        </tr>
        <tr style="background-color: #f9f9f9;">
          <th style="text-align: left; padding: 8px; border: 1px solid #ddd;">Allowed Threshold</th>
          <td style="padding: 8px; border: 1px solid #ddd;">${allowed}</td>
        </tr>
      </table>
      <p><strong>Problem Explanation:</strong> ${explanation}</p>
      <p><strong>Recommendation to appeal:</strong> ${recommendation}</p>
      <p>Please contact our support team at support@amarzone.com to submit an appeal or recovery plan.</p>
      <p>Sincerely,<br/>Amarzone Partner Relations Team</p>
    </div>
  `;

  sendEmail(email, html, `Urgent: Account Suspended due to SLA Violation (${metric})`).catch((err) => {
    console.error(`[SLA Suspension Email] Failed to send to ${email}:`, err);
  });
};

const getVendorViolationsFromDB = async (vendorId: string) => {
  return await SlaViolation.find({ vendor: new mongoose.Types.ObjectId(vendorId) }).sort({ createdAt: -1 });
};

const getAllViolationsFromDB = async (query: Record<string, unknown>) => {
  const violationQuery = new QueryBuilder(SlaViolation.find().populate("vendor"), query)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await violationQuery.countTotal();
  const data = await violationQuery.modelQuery;
  return { meta, data };
};

export const SlaViolationServices = {
  evaluateSla,
  getVendorViolationsFromDB,
  getAllViolationsFromDB,
};
