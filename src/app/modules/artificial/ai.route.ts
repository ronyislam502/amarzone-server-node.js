/**
 * Artificial Intelligence Routes
 *
 * Exposes REST API endpoints for Product Content Generation, Shopping Assistant,
 * Executive Dashboard Insights, and future AI capabilities.
 */

import { Router } from "express";
import { validateRequest } from "../../middlewares/validateRequest";
import { AiControllers } from "./ai.controller";
import { AiValidation } from "./ai.validation";
import { sanitizeAiInput, trackAiTelemetry, parseAiMultipart } from "./ai.middleware";
import { USER_ROLE } from "../../interface/common";
import auth from "../../middlewares/auth";
import { multerUpload } from "../../config/multer.config";

const router = Router();

/**
 * 1. AI PRODUCT CONTENT GENERATOR (Text & Image-based)
 * POST /api/v1/ai/product-content
 */
router.post(
  "/product-content",
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN, USER_ROLE.VENDOR),
  multerUpload.fields([{ name: "images", maxCount: 4 }]),
  parseAiMultipart,
  trackAiTelemetry,
  sanitizeAiInput,
  validateRequest(AiValidation.generateProductContentValidationSchema),
  AiControllers.generateProductContent
);

/**
 * 2. AI SHOPPING ASSISTANT
 * POST /api/v1/ai/shopping-assistant
 */
router.post(
  "/shopping-assistant",
  auth(
    USER_ROLE.CUSTOMER,
    USER_ROLE.VENDOR,
    USER_ROLE.ADMIN,
    USER_ROLE.SUPER_ADMIN
  ),
  trackAiTelemetry,
  sanitizeAiInput,
  validateRequest(AiValidation.shoppingAssistantValidationSchema),
  AiControllers.shoppingAssistant
);

/**
 * 3. AI EXECUTIVE DASHBOARD INSIGHTS
 * POST /api/v1/ai/dashboard-insights
 */
router.post(
  "/dashboard-insights",
  auth(USER_ROLE.VENDOR, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  trackAiTelemetry,
  sanitizeAiInput,
  validateRequest(AiValidation.dashboardInsightsValidationSchema),
  AiControllers.getDashboardInsights
);

/**
 * 4. FUTURE CAPABILITIES (EXTENSIBLE REST HOOKS)
 */
router.post(
  "/review-moderation",
  auth(
    USER_ROLE.CUSTOMER,
    USER_ROLE.VENDOR,
    USER_ROLE.ADMIN,
    USER_ROLE.SUPER_ADMIN
  ),
  trackAiTelemetry,
  sanitizeAiInput,
  validateRequest(AiValidation.reviewModerationValidationSchema),
  AiControllers.moderateReview
);

router.post(
  "/fraud-analysis",
  auth(USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  trackAiTelemetry,
  sanitizeAiInput,
  validateRequest(AiValidation.fraudAnalysisValidationSchema),
  AiControllers.analyzeFraudRisk
);

export const AiRoutes = router;
