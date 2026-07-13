import { Router } from "express";
import auth from "../../middlewares/auth";
import { validateRequest } from "../../middlewares/validateRequest";
import { USER_ROLE } from "../../interface/common";
import { ReviewControllers } from "./review.controller";
import { ReviewValidations } from "./review.validation";

const router = Router();

router.post(
  "/create-review",
  auth(USER_ROLE.CUSTOMER),
  validateRequest(ReviewValidations.createReviewValidationSchema),
  ReviewControllers.createReview
);

router.patch(
  "/update/:id",
  auth(USER_ROLE.CUSTOMER),
  validateRequest(ReviewValidations.updateReviewValidationSchema),
  ReviewControllers.updateReview
);

router.delete(
  "/:id",
  auth(USER_ROLE.CUSTOMER, USER_ROLE.ADMIN, USER_ROLE.SUPER_ADMIN),
  ReviewControllers.deleteReview
);

router.get("/my-reviews", auth(USER_ROLE.CUSTOMER), ReviewControllers.getMyReviews);

router.get("/vendor/:vendorId", ReviewControllers.getReviewsByVendor);

router.get("/:id", ReviewControllers.getSingleReview);

router.get("/", ReviewControllers.getAllReviews);

export const ReviewRoutes = router;
