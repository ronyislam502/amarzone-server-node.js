import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Dispute } from "../dispute/dispute.model";
import { DisputeDecision } from "./disputeDecision.model";
import { TDisputeDecision } from "./disputeDecision.interface";
import { PaymentServices } from "../payment/payment.service";
import { Types } from "mongoose";

const createDecision = async (
  adminId: Types.ObjectId,
  payload: Partial<TDisputeDecision>
) => {
  const { dispute: disputeId, decision, notes } = payload;

  if (!disputeId || !decision || !notes) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Dispute ID, decision, and notes are required"
    );
  }

  // Find the dispute
  const dispute = await Dispute.findById(disputeId);
  if (!dispute) {
    throw new AppError(httpStatus.NOT_FOUND, "Dispute not found");
  }

  // Verify dispute is not already resolved/rejected
  if (dispute.status === "RESOLVED" || dispute.status === "REJECTED") {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This dispute has already been resolved or closed"
    );
  }

  // Save the dispute decision in DB
  const disputeDecision = await DisputeDecision.create({
    dispute: disputeId,
    resolvedBy: adminId,
    decision,
    notes,
  });

  // Update dispute status and resolver
  dispute.status = decision === "REFUNDED" ? "RESOLVED" : "REJECTED";
  dispute.resolvedBy = adminId;
  await dispute.save();

  // If the decision is REFUNDED, delegate the refund request to the existing Payment/Refund Service
  if (decision === "REFUNDED") {
    try {
      await PaymentServices.refundOrder(dispute.order.toString());
    } catch (refundError: any) {
      console.error(
        `[Dispute Decision Service] Failed to delegate refund for order ${dispute.order}:`,
        refundError
      );
      // We log but don't crash since the decision itself is saved successfully.
    }
  }

  return disputeDecision;
};

const getDecisionByDisputeId = async (
  userId: Types.ObjectId,
  userRole: string,
  disputeId: string
) => {
  // First, verify access to the dispute
  const dispute = await Dispute.findById(disputeId);
  if (!dispute) {
    throw new AppError(httpStatus.NOT_FOUND, "Dispute not found");
  }

  if (
    userRole === "CUSTOMER" &&
    dispute.customer.toString() !== userId.toString()
  ) {
    throw new AppError(httpStatus.FORBIDDEN, "Access denied");
  }

  if (
    userRole === "VENDOR" &&
    dispute.vendor.toString() !== userId.toString()
  ) {
    throw new AppError(httpStatus.FORBIDDEN, "Access denied");
  }

  // Find decision
  const decision = await DisputeDecision.findOne({ dispute: disputeId })
    .populate("dispute")
    .populate("resolvedBy", "name email role");

  if (!decision) {
    throw new AppError(
      httpStatus.NOT_FOUND,
      "Decision not found for this dispute"
    );
  }

  return decision;
};

export const DisputeDecisionServices = {
  createDecision,
  getDecisionByDisputeId,
};
