import logger from "@adonisjs/core/services/logger";
import mongoose from "mongoose";

import env from "#start/env";

if (env.get("API_ENV") !== "test") {
  mongoose.connection.on("disconnected", () => {
    logger.error("mongoose connection was disconnected");
  });

  mongoose.connection.on("reconnected", () => {
    logger.warn("mongoose connection was reconnected");
  });

  mongoose.connection.on("error", () => {
    logger.error("mongoose connection has error");
  });

  await mongoose.connect(env.get("MONGODB_URI").release(), {
    dbName: env.get("API_ENV") === "production" ? "production" : "staging",
    maxPoolSize: 10,
    connectTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    autoIndex: env.get("API_ENV") !== "production",
  });
  mongoose.set("debug", env.get("API_ENV") !== "production");
}
