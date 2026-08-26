import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Gate } from "../models/Gate.js";
import { EventAssignment } from "../models/EventAssignment.js";
import { signToken } from "../utils/jwt.js";
import { env } from "../config/env.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const authRouter = express.Router();

/**
 * @openapi
 * /api/auth/setup-admin:
 *   post:
 *     tags: [Auth]
 *     summary: Bootstrap the first admin account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [setupKey, name, email, password]
 *             properties:
 *               setupKey: { type: string, example: "setup-admin" }
 *               name:     { type: string, example: "Alice" }
 *               email:    { type: string, format: email }
 *               password: { type: string, example: "secret" }
 *     responses:
 *       201:
 *         description: Admin created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       403: { description: Invalid setup key }
 *       409: { description: User already exists }
 */
authRouter.post("/setup-admin", async (req, res) => {
  const { setupKey, name, email, password } = req.body;

  if (setupKey !== env.adminSetupKey) {
    return res.status(403).json({ message: "Invalid setup key" });
  }

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "User already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role: "admin" });
  const token = signToken(user);

  return res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and receive a JWT
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthResponse' }
 *       401: { description: Invalid credentials }
 */
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: String(email).toLowerCase() }).populate("assignedGateId");

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = signToken(user);
  return res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      assignedGateId: user.assignedGateId?._id || null,
      assignedGateName: user.assignedGateId?.name || null
    }
  });
});

/**
 * @openapi
 * /api/auth/staff:
 *   get:
 *     tags: [Staff Management]
 *     summary: List all staff users (admin only)
 *     security: [{bearerAuth: []}]
 *     responses:
 *       200:
 *         description: Array of staff users
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/UserPublic' }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden – admin role required }
 *   post:
 *     tags: [Staff Management]
 *     summary: Create a new staff account (admin only)
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:     { type: string }
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       201:
 *         description: Staff user created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/UserPublic' }
 *       400: { description: Missing required fields }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden – admin role required }
 *       409: { description: User already exists }
 */
import { Event } from "../models/Event.js";

async function getManagedEventIdsForUser(userId) {
  const assignments = await EventAssignment.find({ userId, role: "event_admin" }).select("eventId").lean();
  const assignedEventIds = assignments.map((a) => a.eventId.toString());
  const createdEvents = await Event.find({ createdBy: userId }).select("_id").lean();
  const createdEventIds = createdEvents.map((e) => e._id.toString());
  return [...new Set([...assignedEventIds, ...createdEventIds])];
}

authRouter.get("/staff", requireAuth, requireRole("admin"), async (req, res) => {
  const currentRole = req.user.role;
  const currentUserId = req.user.id || req.user.sub;

  if (currentRole === "super_admin" || currentRole === "admin") {
    // Super Admins see all system accounts
    const users = await User.find({ role: { $in: ["super_admin", "event_admin", "event_staff", "admin", "staff"] } })
      .populate("assignedGateId")
      .sort({ createdAt: -1 })
      .lean();
    return res.json(users.map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      assignedGateId: user.assignedGateId?._id || null,
      assignedGateName: user.assignedGateId?.name || null
    })));
  }

  if (currentRole === "event_admin") {
    // Event Admins see ONLY event_staff assigned to their managed events
    const managedEventIds = await getManagedEventIdsForUser(currentUserId);
    const managedGates = await Gate.find({ eventId: { $in: managedEventIds } }).select("_id").lean();
    const managedGateIds = managedGates.map((g) => g._id);

    const staffAssignments = await EventAssignment.find({
      eventId: { $in: managedEventIds },
      role: "event_staff"
    }).select("userId").lean();
    const staffUserIds = staffAssignments.map((a) => a.userId);

    const users = await User.find({
      $and: [
        { role: { $in: ["event_staff", "staff"] } },
        {
          $or: [
            { assignedGateId: { $in: managedGateIds } },
            { _id: { $in: staffUserIds } }
          ]
        }
      ]
    })
      .populate("assignedGateId")
      .sort({ createdAt: -1 })
      .lean();

    return res.json(users.map((user) => ({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      assignedGateId: user.assignedGateId?._id || null,
      assignedGateName: user.assignedGateId?.name || null
    })));
  }

  return res.status(403).json({ message: "Insufficient permissions" });
});

authRouter.post("/staff", requireAuth, requireRole("admin"), async (req, res) => {
  const currentRole = req.user.role;
  const currentUserId = req.user.id || req.user.sub;
  const { name, email, password, role, assignedGateId } = req.body;
  const normalizedEmail = String(email || "").toLowerCase();

  if (!name || !normalizedEmail || !password) {
    return res.status(400).json({ message: "name, email and password are required" });
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ message: "User already exists" });
  }

  // Permission check for event_admin
  if (currentRole === "event_admin") {
    if (role === "super_admin" || role === "admin" || role === "event_admin") {
      return res.status(403).json({ message: "Event Admins can only create Event Staff accounts" });
    }
  }

  let userRole = role;
  if (currentRole === "event_admin") {
    userRole = "event_staff";
  } else {
    userRole = (role === "admin" || role === "super_admin" || role === "event_admin" || role === "event_staff" || role === "staff") ? role : "event_staff";
  }

  const gateId = assignedGateId && mongoose.Types.ObjectId.isValid(assignedGateId) ? assignedGateId : null;

  if (currentRole === "event_admin" && gateId) {
    const managedEventIds = await getManagedEventIdsForUser(currentUserId);
    const gate = await Gate.findById(gateId).lean();
    if (!gate || !managedEventIds.includes(gate.eventId.toString())) {
      return res.status(403).json({ message: "Selected gate does not belong to your managed events" });
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role: userRole,
    assignedGateId: gateId
  });

  if (gateId) {
    const gate = await Gate.findById(gateId).lean();
    if (gate) {
      await EventAssignment.updateOne(
        { userId: user._id, eventId: gate.eventId },
        { $set: { role: "event_staff", assignedGateId: gate._id } },
        { upsert: true }
      );
    }
  }

  const populated = await User.findById(user._id).populate("assignedGateId");
  return res.status(201).json({
    id: populated._id,
    name: populated.name,
    email: populated.email,
    role: populated.role,
    assignedGateId: populated.assignedGateId?._id || null,
    assignedGateName: populated.assignedGateId?.name || null
  });
});

authRouter.put("/staff/:userId", requireAuth, requireRole("admin"), async (req, res) => {
  const currentRole = req.user.role;
  const currentUserId = req.user.id || req.user.sub;
  const { name, email, role, assignedGateId } = req.body;

  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Scoping check for event_admin
    if (currentRole === "event_admin") {
      if (user.role === "super_admin" || user.role === "admin" || user.role === "event_admin") {
        return res.status(403).json({ message: "Event Admins cannot modify administrator accounts" });
      }
      if (role && (role === "super_admin" || role === "admin" || role === "event_admin")) {
        return res.status(403).json({ message: "Event Admins cannot elevate roles to administrator" });
      }
    }

    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (role && currentRole !== "event_admin") user.role = role;
    
    if (assignedGateId !== undefined) {
      const newGateId = assignedGateId && mongoose.Types.ObjectId.isValid(assignedGateId) ? assignedGateId : null;
      
      if (currentRole === "event_admin" && newGateId) {
        const managedEventIds = await getManagedEventIdsForUser(currentUserId);
        const gate = await Gate.findById(newGateId).lean();
        if (!gate || !managedEventIds.includes(gate.eventId.toString())) {
          return res.status(403).json({ message: "Selected gate does not belong to your managed events" });
        }
      }

      user.assignedGateId = newGateId;

      if (newGateId) {
        const gate = await Gate.findById(newGateId).lean();
        if (gate) {
          await EventAssignment.updateOne(
            { userId: user._id, eventId: gate.eventId },
            { $set: { role: "event_staff", assignedGateId: gate._id } },
            { upsert: true }
          );
        }
      }
    }

    await user.save();
    const updated = await User.findById(user._id).populate("assignedGateId");
    return res.json({
      id: updated._id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      assignedGateId: updated.assignedGateId?._id || null,
      assignedGateName: updated.assignedGateId?.name || null
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

authRouter.delete("/staff/:userId", requireAuth, requireRole("admin"), async (req, res) => {
  const currentRole = req.user.role;
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const currentUserId = req.user?.id || req.user?.sub || req.user?._id;

    // Safety check: Prevent users from deleting their own logged-in account
    if (user._id.toString() === currentUserId?.toString()) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    // Scoping check for event_admin
    if (currentRole === "event_admin") {
      if (user.role === "super_admin" || user.role === "admin" || user.role === "event_admin") {
        return res.status(403).json({ message: "Event Admins cannot delete administrator accounts" });
      }
    }

    await User.deleteOne({ _id: req.params.userId });
    return res.json({ message: "User account deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

