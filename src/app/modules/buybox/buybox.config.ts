export const BUY_BOX_CONFIG = {
  minCompletedOrders: Number(process.env.BUY_BOX_MIN_COMPLETED_ORDERS) || 20,
  minAccountHealthScore: Number(process.env.BUY_BOX_MIN_ACCOUNT_HEALTH_SCORE) || 850,
  maxOrderDefectRate: Number(process.env.BUY_BOX_MAX_ORDER_DEFECT_RATE) || 1.0,
  maxCancellationRate: Number(process.env.BUY_BOX_MAX_CANCELLATION_RATE) || 2.5,
  maxLateShipmentRate: Number(process.env.BUY_BOX_MAX_LATE_SHIPMENT_RATE) || 4.0,
  minValidTrackingRate: Number(process.env.BUY_BOX_MIN_VALID_TRACKING_RATE) || 95.0,
  minServiceReviewRating: Number(process.env.BUY_BOX_MIN_SERVICE_REVIEW_RATING) || 4.5,
  assignmentPercentage: Number(process.env.BUY_BOX_ASSIGNMENT_PERCENTAGE) || 25,
};
