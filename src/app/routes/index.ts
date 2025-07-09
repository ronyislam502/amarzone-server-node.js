import { Router } from "express";
import { AuthRoutes } from "../modules/auth/auth.route";
import { UserRoutes } from "../modules/user/user.route";
import { AdminRoutes } from "../modules/admin/admin.route";
import { CustomerRoutes } from "../modules/customer/customer.route";
import { VendorRoutes } from "../modules/vendor/vendor.route";
import { ShopRoutes } from "../modules/shop/shop.route";
import { DepartmentRoutes } from "../modules/department/department.route";

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
    path: "/shops",
    route: ShopRoutes,
  },
  {
    path: "/customers",
    route: CustomerRoutes,
  },
  {
    path: "/departments",
    route: DepartmentRoutes,
  },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
