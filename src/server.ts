import { Server } from "http";
import app from "./app";
import config from "./app/config";
import mongoose from "mongoose";
import { initializeSocket } from "./app/socket/socket";
import { initializeOrderExpiryCron } from "./app/cron/orderExpiry.cron";

let server: Server;

async function main() {
  try {
    await mongoose.connect(config.database_url as string);
    server = app.listen(config.port, () => {
      console.log(`Amarzone API listening on port: ${config.port}`);
    });
    initializeSocket(server);
    initializeOrderExpiryCron();
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
