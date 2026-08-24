import { Router } from "express";
import { UserRoutes } from "../modules/user/user.route";
import { AdminRoutes } from "../modules/admin/admin.route";
import { VendorRoutes } from "../modules/vendor/vendor.route";


const router = Router();

const moduleRoutes = [
  {
    path: "/users",
    route: UserRoutes,
  },
  {
    path: "/admins",
    route: AdminRoutes
  },
  {
    path: "/vendors",
    route: VendorRoutes
  }
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
