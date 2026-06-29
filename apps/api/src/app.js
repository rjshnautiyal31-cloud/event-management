import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { authRouter } from "./routes/auth.routes.js";
import { eventRouter } from "./routes/event.routes.js";
import { publicRouter } from "./routes/public.routes.js";
import { scanRouter } from "./routes/scan.routes.js";
import { swaggerSpec } from "./config/swagger.js";

export const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get("/api-docs.json", (_req, res) => res.json(swaggerSpec));

app.use("/api/auth", authRouter);
app.use("/api/events", eventRouter);
app.use("/api/public", publicRouter);
app.use("/api/scan", scanRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error" });
});

