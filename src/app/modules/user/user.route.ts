import { Router } from "express";
import { UserControllers } from "./user.controller";
import { multerUpload } from "../../config/multer.config";
import { parseBody } from "../../middlewares/bodyParser";
import { validateRequest } from "../../middlewares/validateRequest";
import auth from "../../middlewares/auth";
import { USER_ROLE } from "../../interface/common";

const router = Router();

// router.get("/", UserControllers.getAllUsers);



export const UserRoutes = router;