import { Router } from "express";
import { ServiceReviewControllers } from "./serviceReview.controller";
import { validateRequest } from "../../middlewares/validateRequest";
import { ServiceReviewValidations } from "./serviceReview.validation";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";

const router = Router();

router.post(
  "/create-service-review", auth(USER_ROLE.CUSTOMER),
  validateRequest(ServiceReviewValidations.createServiceReviewValidationSchema),
  ServiceReviewControllers.createServiceReview
);

router.get("/vendor/:id", ServiceReviewControllers.allServiceReviewsByVendor);

export const ServiceReviewRoutes = router;
