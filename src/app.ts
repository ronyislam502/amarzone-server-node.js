import express, { Application, Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import router from "./app/routes";
import notFound from "./app/middlewares/notFound";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import { PaymentControllers } from "./app/modules/payment/payment.controller";

const app: Application = express();

// Stripe webhook route registered with raw body parsing before express.json()
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  PaymentControllers.handleWebhook
);

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["", "http://localhost:5173"],
    credentials: true,
  })
);

app.use("/api/v1", router);

const getController = (req: Request, res: Response) => {
  res.send("amarzone web app");
};

app.get("/", getController);
app.use(globalErrorHandler);
app.use(notFound);

// console.log(process.cwd());

export default app;
