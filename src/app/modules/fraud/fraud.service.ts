import { Types } from "mongoose";
import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { FRAUD_STATUS, ORDER_STATUS, PAYMENT_STATUS } from "../../interface/common";
import { User } from "../user/user.model";
import { Payment } from "../payment/payment.model";
import { Order } from "../order/order.model";
import { Dispute } from "../dispute/dispute.model";
import { Fraud } from "./fraud.model";
import QueryBuilder from "../../builder/queryBuilder";
import { JwtPayload } from "jsonwebtoken";
import { emitFraudAlertCreated, emitFraudAlertUpdated, emitFraudResolved, emitFraudStatusChanged } from "../../socket/socketFraud";

/**
 * Server-side automatic evaluation of user fraud risk based on activity metrics.
 */
const evaluateUserFraudRisk = async (user: JwtPayload) => {
  const isUserExist = await User.isUserExistsByEmail(user.email)

  if (!isUserExist) {
    throw new AppError(httpStatus.NOT_FOUND, "this user not found");
  }

  let score = 0;
  const reasons: string[] = [];

  // Metric 1: Check failed payment attempts
  const failedPaymentsCount = await Payment.countDocuments({
    customer: isUserExist._id,
    status: PAYMENT_STATUS.UNPAID,
  });

  if (failedPaymentsCount >= 5) {
    score += 40;
    reasons.push(`Abnormally high failed payment attempts (${failedPaymentsCount} failed payments)`);
  } else if (failedPaymentsCount >= 3) {
    score += 20;
    reasons.push(`Multiple failed payment attempts (${failedPaymentsCount} failed payments)`);
  }

  // Metric 2: Abnormally high cancellation activity
  const cancelledOrdersCount = await Order.countDocuments({
    customer: isUserExist._id,
    status: ORDER_STATUS.CANCELLED,
  });

  if (cancelledOrdersCount >= 5) {
    score += 30;
    reasons.push(`Excessive order cancellations (${cancelledOrdersCount} cancelled orders)`);
  } else if (cancelledOrdersCount >= 3) {
    score += 15;
    reasons.push(`Repeated order cancellations (${cancelledOrdersCount} cancelled orders)`);
  }

  // Metric 3: Multiple refunds
  const refundedOrdersCount = await Order.countDocuments({
    customer: isUserExist._id,
    status: PAYMENT_STATUS.REFUNDED,
  });
  if (refundedOrdersCount >= 3) {
    score += 25;
    reasons.push(`High frequency of refunded orders (${refundedOrdersCount} refunded orders)`);
  }

  // Metric 4: Dispute activity
  const disputesCount = await Dispute.countDocuments({
    raisedBy: isUserExist._id,
  });
  if (disputesCount >= 3) {
    score += 20;
    reasons.push(`Frequent dispute activity (${disputesCount} disputes raised)`);
  }

  // Cap score between 0 and 100
  score = Math.min(Math.max(score, 0), 100);

  // Determine status based on score threshold
  let calculatedStatus: keyof typeof FRAUD_STATUS = FRAUD_STATUS.SAFE;
  if (score >= 80) {
    calculatedStatus = FRAUD_STATUS.CONFIRMED;
  } else if (score >= 50) {
    calculatedStatus = FRAUD_STATUS.INVESTIGATING;
  } else if (score >= 25) {
    calculatedStatus = FRAUD_STATUS.PENDING;
  } else {
    calculatedStatus = FRAUD_STATUS.SAFE;
  }

  // Check if an unresolved Fraud record exists for this user
  const existingUnresolvedAlert = await Fraud.findOne({
    user: isUserExist._id,
    isResolved: false,
    isDeleted: false,
  });

  if (calculatedStatus !== FRAUD_STATUS.SAFE && score >= 25) {
    if (existingUnresolvedAlert) {
      // DUPLICATE PREVENTION: Update existing unresolved alert
      existingUnresolvedAlert.score = score;
      existingUnresolvedAlert.reasons = reasons;
      existingUnresolvedAlert.status = calculatedStatus;
      await existingUnresolvedAlert.save();

      const populated = await Fraud.findById(existingUnresolvedAlert._id).populate("user", "name email role");
      if (populated) {
        emitFraudAlertUpdated(populated);
      }
      return existingUnresolvedAlert;
    } else {
      // Create new unresolved alert
      const newAlert = await Fraud.create({
        user: isUserExist._id,
        score,
        reasons,
        status: calculatedStatus,
        isResolved: false,
      });

      const populated = await Fraud.findById(newAlert._id).populate("user", "name email role");
      if (populated) {
        emitFraudAlertCreated(populated);
      }
      return newAlert;
    }
  } else {
    // AUTOMATIC RESOLUTION: User is no longer considered suspicious
    if (existingUnresolvedAlert) {
      existingUnresolvedAlert.status = FRAUD_STATUS.SAFE;
      existingUnresolvedAlert.isResolved = true;
      await existingUnresolvedAlert.save();

      const populated = await Fraud.findById(existingUnresolvedAlert._id).populate("user", "name email role");
      if (populated) {
        emitFraudResolved(populated);
      }
      return existingUnresolvedAlert;
    }
    return null;
  }
};

/**
 * Admin: Get all fraud alerts with filtering, search, pagination, and sorting using QueryBuilder.
 */
const getAllFraudAlertsFromDB = async (query: Record<string, unknown>) => {
  const fraudSearchableFields = ["status", "notes", "reasons"];

  const fraudQuery = new QueryBuilder(
    Fraud.find({ isDeleted: false })
      .populate("user", "name email role status")
      .populate("reviewedBy", "name email"),
    query
  )
    .search(fraudSearchableFields)
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await fraudQuery.countTotal();
  const data = await fraudQuery.modelQuery;

  return {
    meta,
    data,
  };
};

/**
 * Admin: Get fraud alerts history for a specific user.
 */
const getFraudAlertsByUserIdFromDB = async (userId: string) => {
  const alerts = await Fraud.find({
    user: userId,
    isDeleted: false,
  })
    .populate("user", "name email role status")
    .populate("reviewedBy", "name email")
    .sort({ createdAt: -1 });

  return alerts;
};

/**
 * Admin: Update fraud alert status & notes.
 */
const updateFraudStatusInDB = async (
  id: string,
  adminId: string,
  payload: { status: keyof typeof FRAUD_STATUS; notes?: string }
) => {
  const alert = await Fraud.findOne({ _id: id, isDeleted: false });
  if (!alert) {
    throw new AppError(httpStatus.NOT_FOUND, "Fraud record not found");
  }

  alert.status = payload.status;
  if (payload.notes) {
    alert.notes = payload.notes;
  }
  alert.reviewedBy = adminId as any;

  if (payload.status === FRAUD_STATUS.SAFE || payload.status === FRAUD_STATUS.CLEARED) {
    alert.isResolved = true;
  }

  await alert.save();

  const updatedAlert = await Fraud.findById(alert._id)
    .populate("user", "name email role status")
    .populate("reviewedBy", "name email");

  if (updatedAlert) {
    if (payload.status === FRAUD_STATUS.SAFE || payload.status === FRAUD_STATUS.CLEARED) {
      emitFraudResolved(updatedAlert);
    } else {
      emitFraudStatusChanged(updatedAlert);
    }
  }

  return updatedAlert;
};

export const FraudServices = {
  evaluateUserFraudRisk,
  getAllFraudAlertsFromDB,
  getFraudAlertsByUserIdFromDB,
  updateFraudStatusInDB,
};
