import { getIO } from "./socket";
import { IViolation } from "../modules/violation/violation.interface";

export const emitVendorWarning = (vendorId: string, violation: IViolation) => {
  try {
    const io = getIO();
    io.to(vendorId).emit("sla-warning", {
      message: `Your account health has violated an SLA requirement for metric: ${violation.metric}. Severity: Warning.`,
      violation,
    });
  } catch (error) {
    console.error(`[Socket Violation] Failed to emit warning to vendor ${vendorId}:`, error);
  }
};

export const emitVendorSuspended = (vendorId: string, violation: IViolation) => {
  try {
    const io = getIO();
    io.to(vendorId).emit("sla-suspended", {
      message: `Your account has been suspended due to severe SLA violation on metric: ${violation.metric}.`,
      violation,
    });
  } catch (error) {
    console.error(`[Socket Violation] Failed to emit suspension to vendor ${vendorId}:`, error);
  }
};

export const emitViolationResolved = (vendorId: string, violation: IViolation) => {
  try {
    const io = getIO();
    io.to(vendorId).emit("sla-resolved", {
      message: `The SLA violation on metric: ${violation.metric} has been resolved. Your account is compliant.`,
      violation,
    });
  } catch (error) {
    console.error(`[Socket Violation] Failed to emit resolution to vendor ${vendorId}:`, error);
  }
};
