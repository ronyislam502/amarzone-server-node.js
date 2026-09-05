import { Router } from "express";
import { UserRoutes } from "../modules/user/user.route";
import { AdminRoutes } from "../modules/admin/admin.route";
import { VendorRoutes } from "../modules/vendor/vendor.route";
import { CustomerRoutes } from "../modules/customer/customer.route";
import { DepartmentRoutes } from "../modules/department/department.route";
import { CategoryRoutes } from "../modules/category/category.route";
import { ProductRoutes } from "../modules/product/product.route";
import { VariantRoutes } from "../modules/variant/variant.route";
import { AuthRoutes } from "../modules/auth/auth.route";
import { InventoryRoutes } from "../modules/inventory/inventory.route";
import { OrderRoutes } from "../modules/order/order.route";
import { ServiceReviewRoutes } from "../modules/serviceReview/serviceReview.route";
import { PaymentRoutes } from "../modules/payment/payment.route";
import { DashboardRoutes } from "../modules/dashboard/dashboard.route";
import { ProductReviewRoutes } from "../modules/productReview/productReview.route";
import { DisputeRoutes } from "../modules/dispute/dispute.route";
import { DisputeDecisionRoutes } from "../modules/disputeDecision/disputeDecision.route";
import { FraudRoutes } from "../modules/fraud/fraud.route";
import { AccountHealthRoutes } from "../modules/health/health.route";
import { NotificationRoutes } from "../modules/notification/notification.route";
import { SlaViolationRoutes } from "../modules/violation/violation.route";

const router = Router();

const moduleRoutes = [
  {
    path: "/auth",
    route: AuthRoutes,
  },
  {
    path: "/users",
    route: UserRoutes,
  },
  {
    path: "/admins",
    route: AdminRoutes,
  },
  {
    path: "/vendors",
    route: VendorRoutes,
  },
  {
    path: "/customers",
    route: CustomerRoutes,
  },
  {
    path: "/departments",
    route: DepartmentRoutes,
  },
  {
    path: "/categories",
    route: CategoryRoutes,
  },
  {
    path: "/products",
    route: ProductRoutes,
  },
  {
    path: "/variants",
    route: VariantRoutes,
  },
  {
    path: "/inventories",
    route: InventoryRoutes,
  },
  {
    path: "/orders",
    route: OrderRoutes,
  },
  {
    path: "/product-reviews",
    route: ProductReviewRoutes,
  },
  {
    path: "/service-reviews",
    route: ServiceReviewRoutes,
  },
  {
    path: "/payments",
    route: PaymentRoutes,
  },
  {
    path: "/dashboard",
    route: DashboardRoutes,
  },
  {
    path: "/disputes",
    route: DisputeRoutes,
  },
  {
    path: "/dispute-decisions",
    route: DisputeDecisionRoutes,
  },
  {
    path: "/frauds",
    route: FraudRoutes,
  },
  {
    path: "/fraud",
    route: FraudRoutes,
  },
  {
    path: "/account-health",
    route: AccountHealthRoutes,
  },
  {
    path: "/health",
    route: AccountHealthRoutes,
  },
  {
    path: "/notifications",
    route: NotificationRoutes,
  },
  {
    path: "/sla-violations",
    route: SlaViolationRoutes,
  },
  {
    path: "/violations",
    route: SlaViolationRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
