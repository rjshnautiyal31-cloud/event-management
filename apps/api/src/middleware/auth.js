import mongoose from "mongoose";
import { verifyToken, extractCompanyId } from "../utils/jwt.js";
import { EventAssignment } from "../models/EventAssignment.js";
import { Attendee } from "../models/Attendee.js";
import { Event } from "../models/Event.js";
import { User } from "../models/User.js";
import { Company } from "../models/Company.js";

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.substring(7) : (req.query?.token || null);

  if (!token) {
    return res.status(401).json({ message: "Missing auth token" });
  }

  try {
    const decoded = verifyToken(token);
    const userId = decoded.sub || decoded.id || decoded._id;
    let companyId = extractCompanyId(decoded.companyId);
    let role = decoded.role;

    // Fallback if companyId is missing from token (e.g. older session or null)
    if (!companyId && role !== "super_admin") {
      const dbUser = await User.findById(userId).select("companyId role").lean();
      if (dbUser) {
        role = dbUser.role || role;
        companyId = extractCompanyId(dbUser.companyId);

        // Self-heal: If user in DB still has no companyId, find active company and link user
        if (!companyId) {
          const activeCompany = await Company.findOne({ isActive: true }).sort({ createdAt: 1 });
          if (activeCompany) {
            companyId = activeCompany._id.toString();
            await User.updateOne({ _id: userId }, { $set: { companyId: activeCompany._id } });
            console.log(`[Auth] Self-healed orphaned user ${userId} -> linked to company ${companyId}`);
          }
        }
      }
    }

    req.user = {
      ...decoded,
      id: userId,
      role,
      companyId
    };
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const userRole = req.user.role;
    const isAllowed = roles.some((role) => {
      // Support aliases for backward compatibility
      if (role === "admin" && (userRole === "owner" || userRole === "co_owner" || userRole === "event_admin" || userRole === "super_admin" || userRole === "admin")) return true;
      if (role === "owner_or_co_owner" && (userRole === "owner" || userRole === "co_owner" || userRole === "super_admin")) return true;
      if (role === "staff" && (userRole === "event_staff" || userRole === "staff")) return true;
      return userRole === role;
    });

    if (!isAllowed) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    return next();
  };
}

export function requireEventAccess(allowedRoles = ["event_admin", "event_staff"]) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const userId = req.user.id;
      const userRole = req.user.role;
      const userCompanyId = extractCompanyId(req.user.companyId);

      // 1. Super Admins bypass event-level scoping completely
      if (userRole === "super_admin") {
        return next();
      }

      // 2. Resolve target eventId from request parameters, body, query, or ticketUuid lookup
      let eventId = req.params.eventId || req.body.eventId || req.query.eventId;

      if (!eventId && req.body.ticketUuid) {
        const attendee = await Attendee.findOne({ ticketUuid: req.body.ticketUuid }).select("eventId").lean();
        if (!attendee) {
          return res.status(404).json({ status: "invalid", message: "Invalid Ticket" });
        }
        eventId = attendee.eventId;
        req.resolvedEventId = eventId;
      }

      if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
        return res.status(400).json({ message: "Valid event context (eventId) is required for authorization" });
      }

      // 3. Find event and verify company tenant ownership
      const event = await Event.findById(eventId).select("companyId createdBy").lean();
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const eventCompanyId = extractCompanyId(event.companyId);
      if (userCompanyId && eventCompanyId && eventCompanyId !== userCompanyId) {
        return res.status(403).json({ message: "Access denied: Event does not belong to your company" });
      }

      // 4. Owners and Co-Owners automatically have full administrative access to all company events
      if (userRole === "owner" || userRole === "co_owner") {
        req.eventAssignment = { userId, eventId, role: "event_admin" };
        return next();
      }

      // 5. Check if user is event creator
      const isCreator = event.createdBy && event.createdBy.toString() === userId.toString();

      // 6. Query EventAssignment collection for explicit grants
      let assignment = await EventAssignment.findOne({
        userId,
        eventId
      }).lean();

      // If user created the event or is event_admin with created event, auto-grant event_admin
      if (!assignment && (isCreator || userRole === "event_admin")) {
        assignment = { userId, eventId, role: "event_admin" };
        EventAssignment.updateOne(
          { userId, eventId },
          { $setOnInsert: { role: "event_admin", assignedGateId: null } },
          { upsert: true }
        ).catch(() => {});
      }

      if (!assignment) {
        return res.status(403).json({ message: "Access denied: You are not assigned to this event" });
      }

      const assignedRole = assignment.role || (isCreator ? "event_admin" : userRole);

      // 7. Role Hierarchy & Permission Validation
      const isAllowed = allowedRoles.some((role) => {
        if (role === "event_admin" && (assignedRole === "event_admin" || userRole === "event_admin")) return true;
        if (role === "event_staff" && (assignedRole === "event_staff" || assignedRole === "staff" || assignedRole === "event_admin" || userRole === "event_admin")) return true;
        return assignedRole === role;
      });

      if (!isAllowed) {
        return res.status(403).json({ message: "Access denied: Insufficient permissions for this event" });
      }

      req.eventAssignment = assignment;
      return next();
    } catch (error) {
      console.error("Error in requireEventAccess:", error);
      return res.status(500).json({ message: error.message || "Authorization check failed" });
    }
  };
}
