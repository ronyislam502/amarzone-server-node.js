import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Order } from "../order/order.model";
import { Dispute } from "./dispute.model";
import { TDispute } from "./dispute.interface";
import { ChatServices } from "../chat/chat.service";
import { Types } from "mongoose";
import QueryBuilder from "../../builder/queryBuilder";

const createDispute = async (
  currentUserId: Types.ObjectId,
  payload: Partial<TDispute>
) => {
  const { order, reason, details, evidenceUrls } = payload;

  if (!order) {
    throw new AppError(httpStatus.BAD_REQUEST, "Order ID is required");
  }

  // Verify the order exists
  const orderObj = await Order.findById(order);
  if (!orderObj) {
    throw new AppError(httpStatus.NOT_FOUND, "Order not found");
  }

  // Only the customer who placed the order can raise a dispute
  if (orderObj.customer.toString() !== currentUserId.toString()) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Access denied. Only the customer who placed the order can raise a dispute."
    );
  }

  // Create dispute
  const dispute = await Dispute.create({
    order,
    customer: currentUserId,
    vendor: orderObj.vendor,
    reason,
    details,
    evidenceUrls,
    status: "OPEN",
  });

  // Automatically create a DISPUTE conversation between customer and vendor
  await ChatServices.createConversation(currentUserId, {
    participants: [currentUserId, orderObj.vendor],
    conversationType: "DISPUTE",
    order: orderObj._id,
    dispute: dispute._id,
  });

  return dispute;
};

const getDisputeById = async (userId: Types.ObjectId, userRole: string, disputeId: string) => {
  const dispute = await Dispute.findById(disputeId)
    .populate("order")
    .populate("customer", "name email role")
    .populate("vendor", "name email role")
    .populate("resolvedBy", "name email role");

  if (!dispute) {
    throw new AppError(httpStatus.NOT_FOUND, "Dispute not found");
  }

  // Authorization check: Customer, Vendor or Admin/SuperAdmin
  if (
    userRole === "CUSTOMER" &&
    dispute.customer.toString() !== userId.toString()
  ) {
    throw new AppError(httpStatus.FORBIDDEN, "Access denied to this dispute");
  }

  if (
    userRole === "VENDOR" &&
    dispute.vendor.toString() !== userId.toString()
  ) {
    throw new AppError(httpStatus.FORBIDDEN, "Access denied to this dispute");
  }

  return dispute;
};

const getUserDisputes = async (
  userId: Types.ObjectId,
  userRole: string,
  query: Record<string, unknown>
) => {
  const filterQuery: Record<string, any> = {};

  if (userRole === "CUSTOMER") {
    filterQuery.customer = userId;
  } else if (userRole === "VENDOR") {
    filterQuery.vendor = userId;
  }

  const disputeQuery = new QueryBuilder(Dispute.find(filterQuery), query)
    .search(["reason", "details"])
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await disputeQuery.countTotal();
  const data = await disputeQuery.modelQuery
    .populate("order")
    .populate("customer", "name email role")
    .populate("vendor", "name email role")
    .populate("resolvedBy", "name email role");

  return { meta, data };
};

const updateDisputeStatus = async (
  adminId: Types.ObjectId,
  disputeId: string,
  payload: Partial<TDispute>
) => {
  const dispute = await Dispute.findById(disputeId);
  if (!dispute) {
    throw new AppError(httpStatus.NOT_FOUND, "Dispute not found");
  }

  const { status } = payload;
  if (status) {
    dispute.status = status;
  }

  dispute.resolvedBy = adminId;
  await dispute.save();

  return dispute;
};

export const DisputeServices = {
  createDispute,
  getDisputeById,
  getUserDisputes,
  updateDisputeStatus,
};
