import { Server, Socket } from "socket.io";
import { getIO } from "./socket";
import { IFraud } from "../modules/fraud/fraud.interface";
import { FRAUD_STATUS } from "../interface/common";

/**
 * Register fraud-related socket connection handlers.
 * Admin users are joined to the "ADMIN" room to receive real-time fraud alerts.
 */
export const registerFraudHandlers = (io: Server, socket: Socket) => {
  const user = socket.data?.user;
  if (user && (user.role === "ADMIN" || user.role === "SUPER_ADMIN")) {
    socket.join("ADMIN");
    console.log(`[Socket Fraud] Admin ${user._id} (${user.email}) joined ADMIN room`);
  }
};

const getUserIdString = (user: any): string | null => {
  if (!user) return null;
  if (typeof user === "object" && user._id) {
    return user._id.toString();
  }
  return user.toString();
};

/**
 * Emit real-time notification when a new fraud alert is created.
 */
export const emitFraudAlertCreated = (fraudAlert: IFraud) => {
  try {
    const io = getIO();
    io.to("ADMIN").emit("fraudAlertCreated", {
      message: "New fraud alert created",
      fraudAlert,
    });

    if (
      fraudAlert.status === FRAUD_STATUS.PENDING ||
      fraudAlert.status === FRAUD_STATUS.INVESTIGATING ||
      fraudAlert.status === FRAUD_STATUS.CONFIRMED
    ) {
      io.to("ADMIN").emit("fraudStatusChanged", {
        message: `High risk fraud alert created for user status: ${fraudAlert.status}`,
        fraudAlert,
      });
    }
  } catch (error) {
    console.error("[Socket Fraud] Error emitting fraudAlertCreated:", error);
  }
};

/**
 * Emit real-time notification when an existing unresolved fraud alert is updated.
 */
export const emitFraudAlertUpdated = (fraudAlert: IFraud) => {
  try {
    const io = getIO();
    io.to("ADMIN").emit("fraudAlertUpdated", {
      message: "Fraud alert updated",
      fraudAlert,
    });

    if (
      fraudAlert.status === FRAUD_STATUS.PENDING ||
      fraudAlert.status === FRAUD_STATUS.INVESTIGATING ||
      fraudAlert.status === FRAUD_STATUS.CONFIRMED
    ) {
      io.to("ADMIN").emit("fraudStatusChanged", {
        message: `Fraud alert updated with status: ${fraudAlert.status}`,
        fraudAlert,
      });
    }
  } catch (error) {
    console.error("[Socket Fraud] Error emitting fraudAlertUpdated:", error);
  }
};

/**
 * Emit real-time notification when a fraud status changes.
 */
export const emitFraudStatusChanged = (fraudAlert: IFraud) => {
  try {
    const io = getIO();
    io.to("ADMIN").emit("fraudStatusChanged", {
      message: `Fraud status changed to ${fraudAlert.status}`,
      fraudAlert,
    });

    const userIdStr = getUserIdString(fraudAlert.user);
    if (userIdStr) {
      io.to(`user:${userIdStr}`).emit("fraudStatusChanged", {
        message: `Your account fraud status is currently: ${fraudAlert.status}`,
        status: fraudAlert.status,
      });
    }
  } catch (error) {
    console.error("[Socket Fraud] Error emitting fraudStatusChanged:", error);
  }
};

/**
 * Emit real-time notification when a fraud alert is resolved or returned to SAFE.
 */
export const emitFraudResolved = (fraudAlert: IFraud) => {
  try {
    const io = getIO();
    io.to("ADMIN").emit("fraudResolved", {
      message: "Fraud alert resolved",
      fraudAlert,
    });

    const userIdStr = getUserIdString(fraudAlert.user);
    if (userIdStr) {
      io.to(`user:${userIdStr}`).emit("fraudResolved", {
        message: "Your account fraud risk has been cleared/resolved.",
        status: FRAUD_STATUS.SAFE,
      });
    }
  } catch (error) {
    console.error("[Socket Fraud] Error emitting fraudResolved:", error);
  }
};
