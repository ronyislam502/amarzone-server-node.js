import { Router } from "express";
import { ServiceReviewControllers } from "./serviceReview.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { ServiceReviewValidations } from "./serviceReview.validation";

const router = Router();

router.post(
  "/create-service-review",
  validateRequest(ServiceReviewValidations.createServiceReviewValidationSchema),
  ServiceReviewControllers.createServiceReview
);

router.get("/vendor/:id", ServiceReviewControllers.allServiceReviewsByVendor);

export const ServiceReviewRoutes = router;
