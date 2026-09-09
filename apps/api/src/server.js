import { app } from "./app.js";
import { connectDb } from "./config/db.js";
import { env, loadDbSettings } from "./config/env.js";
async function bootstrap() {
  await connectDb();
  await loadDbSettings();
  console.log(`[Config] Loaded environment and database settings.`);
  const listenPort = Number(process.env.PORT) || env.port || 8080;
  const server = app.listen(listenPort, "0.0.0.0", () => {
    console.log(`API listening on 0.0.0.0:${listenPort}`);
  });

  process.on("SIGTERM", () => {
    console.log("SIGTERM received, shutting down gracefully...");
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});

