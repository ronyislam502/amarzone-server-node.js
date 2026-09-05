import express, { Application, Request, Response } from "express";
import cors from "cors";
import router from "./app/routes";
import notFound from "./app/middlewares/notFound";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import { PaymentControllers } from "./app/modules/payment/payment.controller";
import cookieParser from "cookie-parser";

const app: Application = express();

// Webhook route must use express.raw before express.json() parses it
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  PaymentControllers.stripeWebhook
);

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:3001", "http://localhost:3000"],
    credentials: true,
  })
);

app.use("/api/v1", router);

const getController = (req: Request, res: Response) => {
  res.send("Welcome to Amarzone API");
};

app.get("/", getController);
app.use(globalErrorHandler);
app.use(notFound);

export default app;
