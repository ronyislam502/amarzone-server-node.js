import { Server, Socket } from "socket.io";
import { IFraud } from "../modules/fraud/fraud.interface";
import { FRAUD_STATUS, SOCKET_EVENTS, USER_ROLE } from "../interface/common";
import { getIO } from "./socket";

/**
 * Register fraud-related socket connection handlers.
 * Admin users are joined to the "ADMIN" room to receive real-time fraud alerts.
 */
export const registerFraudHandlers = (io: Server, socket: Socket) => {
  const checkAndJoinAdmin = (user?: any) => {
    const role = user?.role || socket.data?.user?.role;
    if (role === USER_ROLE.ADMIN || role === USER_ROLE.SUPER_ADMIN) {
      socket.join(SOCKET_EVENTS.ADMIN_ROOM);
      console.log(`[Socket Fraud] Socket ${socket.id} joined ADMIN room`);
    }
  };

  checkAndJoinAdmin(socket.data?.user);

  socket.on("join_admin", () => {
    checkAndJoinAdmin(socket.data?.user);
  });
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
    io.to(SOCKET_EVENTS.ADMIN_ROOM).emit(SOCKET_EVENTS.FRAUD_ALERT_CREATED, {
      message: "New fraud alert created",
      fraudAlert,
    });

    if (
      fraudAlert.status === FRAUD_STATUS.PENDING ||
      fraudAlert.status === FRAUD_STATUS.INVESTIGATING ||
      fraudAlert.status === FRAUD_STATUS.CONFIRMED
    ) {
      io.to(SOCKET_EVENTS.ADMIN_ROOM).emit(SOCKET_EVENTS.FRAUD_STATUS_CHANGED, {
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
    io.to(SOCKET_EVENTS.ADMIN_ROOM).emit(SOCKET_EVENTS.FRAUD_ALERT_UPDATED, {
      message: "Fraud alert updated",
      fraudAlert,
    });

    if (
      fraudAlert.status === FRAUD_STATUS.PENDING ||
      fraudAlert.status === FRAUD_STATUS.INVESTIGATING ||
      fraudAlert.status === FRAUD_STATUS.CONFIRMED
    ) {
      io.to(SOCKET_EVENTS.ADMIN_ROOM).emit(SOCKET_EVENTS.FRAUD_STATUS_CHANGED, {
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
    io.to(SOCKET_EVENTS.ADMIN_ROOM).emit(SOCKET_EVENTS.FRAUD_STATUS_CHANGED, {
      message: `Fraud status changed to ${fraudAlert.status}`,
      fraudAlert,
    });

    const userIdStr = getUserIdString(fraudAlert.user);
    if (userIdStr) {
      io.to(`user:${userIdStr}`).emit(SOCKET_EVENTS.FRAUD_STATUS_CHANGED, {
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
    io.to(SOCKET_EVENTS.ADMIN_ROOM).emit(SOCKET_EVENTS.FRAUD_RESOLVED, {
      message: "Fraud alert resolved",
      fraudAlert,
    });

    const userIdStr = getUserIdString(fraudAlert.user);
    if (userIdStr) {
      io.to(`user:${userIdStr}`).emit(SOCKET_EVENTS.FRAUD_RESOLVED, {
        message: "Your account fraud risk has been cleared/resolved.",
        status: FRAUD_STATUS.SAFE,
      });
    }
  } catch (error) {
    console.error("[Socket Fraud] Error emitting fraudResolved:", error);
  }
};
