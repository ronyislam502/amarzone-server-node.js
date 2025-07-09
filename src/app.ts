import express, { Application, Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import router from "./app/routes";
import notFound from "./app/middlewares/notFound";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";

const app: Application = express();

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
