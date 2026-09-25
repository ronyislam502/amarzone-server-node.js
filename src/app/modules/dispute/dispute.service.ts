import httpStatus from "http-status";
import AppError from "../../errors/AppError";
import { Order } from "../order/order.model";
import { Dispute } from "./dispute.model";
import { TDispute } from "./dispute.interface";
import { Types } from "mongoose";
import QueryBuilder from "../../builder/queryBuilder";
import { ConversationServices } from "../chat/conversation/conversation.service";
import { JwtPayload } from "jsonwebtoken";
import { User } from "../user/user.model";
import { USER_ROLE } from "../../interface/common";

const createDispute = async (
  user: JwtPayload,
  payload: Partial<TDispute>
) => {
  const isUser = await User.isUserExistsByEmail(user.email)

  if (!isUser) {
    throw new AppError(httpStatus.NOT_FOUND, "user not found")
  }
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
  const orderCustomerId =
    (orderObj.customer as any)?._id?.toString() ||
    orderObj.customer?.toString();

  if (orderCustomerId !== isUser._id.toString()) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Access denied. Only the customer who placed the order can raise a dispute."
    );
  }

  // Create dispute
  const dispute = await Dispute.create({
    order,
    customer: isUser._id,
    vendor: orderObj.vendor,
    reason,
    details,
    evidenceUrls,
    status: "OPEN",
  });

  // Automatically create a DISPUTE conversation between customer and vendor
  await ConversationServices.createConversation(isUser._id, {
    participants: [isUser._id, orderObj.vendor],
    conversationType: "DISPUTE",
    order: orderObj._id as Types.ObjectId,
    dispute: dispute._id as Types.ObjectId,
  });

  return dispute;
};

const getDisputeById = async (user: JwtPayload, id: string) => {

  const isUser = await User.isUserExistsByEmail(user.email)

  if (!isUser) {
    throw new AppError(httpStatus.NOT_FOUND, "user not found")
  }
  const dispute = await Dispute.findById(id)
    .populate("order")
    .populate("customer", "name email role")
    .populate("vendor", "name email role")
    .populate("resolvedBy", "name email role");

  if (!dispute) {
    throw new AppError(httpStatus.NOT_FOUND, "Dispute not found");
  }

  const customerId =
    (dispute.customer as any)?._id?.toString() ||
    dispute.customer?.toString();

  const vendorId =
    (dispute.vendor as any)?._id?.toString() ||
    dispute.vendor?.toString();

  const currentUserId = isUser._id.toString();

  // Authorization check: Customer, Vendor or Admin/SuperAdmin
  if (
    isUser.role === USER_ROLE.CUSTOMER &&
    customerId !== currentUserId
  ) {
    throw new AppError(httpStatus.FORBIDDEN, "Access denied to this dispute");
  }

  if (
    isUser.role === USER_ROLE.VENDOR &&
    vendorId !== currentUserId
  ) {
    throw new AppError(httpStatus.FORBIDDEN, "Access denied to this dispute");
  }

  return dispute;
};

const getUserDisputesFromDB = async (
  user: JwtPayload,
  query: Record<string, unknown>
) => {
  const isUserExists = await User.isUserExistsByEmail(user.email);

  if (!isUserExists) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  let userQuery = {};

  // Customer → only their own disputes
  if (isUserExists.role === USER_ROLE.CUSTOMER) {
    userQuery = {
      customer: isUserExists._id,
    };
  }
  // Vendor → only disputes related to them
  else if (isUserExists.role === USER_ROLE.VENDOR) {
    userQuery = {
      vendor: isUserExists._id,
    };
  }

  // Admin / Super Admin → all disputes
  else if (
    isUserExists.role === USER_ROLE.ADMIN ||
    isUserExists.role === USER_ROLE.SUPER_ADMIN
  ) {
    userQuery = {};
  }

  // Other roles → access denied
  else {
    throw new AppError(httpStatus.FORBIDDEN, "Access denied");
  }

  const disputeQuery = new QueryBuilder(
    Dispute.find(userQuery),
    query
  )
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

  return {
    meta,
    data,
  };
};

const updateDisputeStatus = async (
  user: JwtPayload,
  disputeId: string,
  payload: Partial<TDispute>
) => {

  const isUserExists = await User.isUserExistsByEmail(user.email);

  if (!isUserExists) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (isUserExists.role !== USER_ROLE.ADMIN && isUserExists.role !== USER_ROLE.SUPER_ADMIN) {
    throw new AppError(httpStatus.FORBIDDEN, "You are not authorized to update dispute status");
  }

  const dispute = await Dispute.findById(disputeId);
  if (!dispute) {
    throw new AppError(httpStatus.NOT_FOUND, "Dispute not found");
  }

  const { status } = payload;
  if (status) {
    dispute.status = status;
  }

  dispute.resolvedBy = isUserExists._id;
  await dispute.save();

  return dispute;
};

export const DisputeServices = {
  createDispute,
  getDisputeById,
  getUserDisputesFromDB,
  updateDisputeStatus,
};
