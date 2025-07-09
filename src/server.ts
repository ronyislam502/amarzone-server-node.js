import { Server } from "http";
import app from "./app";
import config from "./app/config";
import mongoose from "mongoose";

let server: Server;

async function main() {
  try {
    await mongoose.connect(config.database_url as string);
    server = app.listen(config.port, () => {
      console.log(`amarzone app listening on port: ${config.port}`);
    });
  } catch (err) {
    console.log(err);
  }
}
main();

process.on("unhandledRejection", () => {
  if (server) {
    console.log("unhandledRejection is deleted, shutting down");
    server.close(() => {
      process.exit(1);
    });
  }
  process.exit(1);
});

process.on("uncaughtException", () => {
  console.log("uncaughtException is deleted, shutting down");
  process.exit(1);
});
