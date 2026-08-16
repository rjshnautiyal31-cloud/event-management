import { verifyToken } from "../utils/jwt.js";
import { EventAssignment } from "../models/EventAssignment.js";
import { Attendee } from "../models/Attendee.js";
import { Event } from "../models/Event.js";

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.substring(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing auth token" });
  }

  try {
    const decoded = verifyToken(token);
    req.user = {
      ...decoded,
      id: decoded.sub || decoded.id || decoded._id
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
    // Support alias roles: 'admin' maps to 'super_admin' or 'admin' or 'event_admin', 'staff' maps to 'event_staff' or 'staff'
    const userRole = req.user.role;
    const isAllowed = roles.some((role) => {
      if (role === "admin" && (userRole === "admin" || userRole === "super_admin" || userRole === "event_admin")) return true;
      if (role === "staff" && (userRole === "staff" || userRole === "event_staff")) return true;
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
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userId = req.user.id || req.user.sub;
    const userRole = req.user.role;

    // 1. Super User Fallback: Super Admins bypass event-level scoping completely
    if (userRole === "super_admin" || userRole === "admin") {
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

    if (!eventId) {
      return res.status(400).json({ message: "Event context (eventId) is required for authorization" });
    }

    // 3. Query event object to check if user is creator
    const event = await Event.findById(eventId).select("createdBy").lean();
    const isCreator = event && event.createdBy && event.createdBy.toString() === userId.toString();

    // 4. Query EventAssignment collection for explicit grants
    let assignment = await EventAssignment.findOne({
      userId,
      eventId
    }).lean();

    // If user created the event or is event_admin with created event, auto-grant event_admin
    if (!assignment && (isCreator || userRole === "event_admin")) {
      assignment = { userId, eventId, role: "event_admin" };
      // Auto-heal missing assignment record in background
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

    // 5. Role Hierarchy & Permission Validation with alias matching
    const isAllowed = allowedRoles.some((role) => {
      if (role === "event_admin" && (assignedRole === "event_admin" || assignedRole === "admin" || userRole === "event_admin")) return true;
      if (role === "event_staff" && (assignedRole === "event_staff" || assignedRole === "staff" || assignedRole === "event_admin" || userRole === "event_admin")) return true;
      return assignedRole === role;
    });

    if (!isAllowed) {
      return res.status(403).json({ message: "Access denied: Insufficient permissions for this event" });
    }

    req.eventAssignment = assignment;
    return next();
  };
}

