import express, { Application, Request, Response } from "express";
import cors from "cors";
import router from "./app/routes";
import notFound from "./app/middlewares/notFound";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";

const app: Application = express();

// Webhook route must use express.raw before express.json() parses it
app.use("/api/v1/payments/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(cors());

app.use("/api/v1", router);

const getController = (req: Request, res: Response) => {
  res.send("Welcome to Amarzone API");
};

app.get("/", getController);
app.use(globalErrorHandler);
app.use(notFound);

export default app;
