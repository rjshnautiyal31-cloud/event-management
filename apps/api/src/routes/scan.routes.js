import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createCheckinService } from "../services/checkinService.js";
import { extractTicketUuid } from "../utils/ticket.js";

const checkinService = createCheckinService();

export const scanRouter = express.Router();

scanRouter.use(requireAuth, requireRole("admin", "staff"));

scanRouter.post("/validate", async (req, res) => {
  const { ticketUuid, gateNumber } = req.body;
  const normalizedTicketUuid = extractTicketUuid(ticketUuid);

  if (!normalizedTicketUuid) {
    return res.status(400).json({ message: "ticketUuid is required" });
  }

  const result = await checkinService.validateAndCheckIn({
    ticketUuid: normalizedTicketUuid,
    gateNumber: String(gateNumber || "").trim()
  });

  if (result.status === "invalid") {
    return res.status(404).json(result);
  }

  if (result.status === "already_checked_in") {
    return res.status(409).json(result);
  }

  return res.json(result);
});

