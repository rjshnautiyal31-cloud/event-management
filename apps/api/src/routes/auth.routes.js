import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/User.js";
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
authRouter.get("/staff", requireAuth, requireRole("admin"), async (_req, res) => {
  // Fetch both staff and admin accounts for full user management and populate assignedGateId
  const users = await User.find({ role: { $in: ["admin", "staff"] } })
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
});

authRouter.post("/staff", requireAuth, requireRole("admin"), async (req, res) => {
  const { name, email, password, role, assignedGateId } = req.body;
  const normalizedEmail = String(email || "").toLowerCase();

  if (!name || !normalizedEmail || !password) {
    return res.status(400).json({ message: "name, email and password are required" });
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ message: "User already exists" });
  }

  // Ensure role is valid, defaulting to staff
  const userRole = (role === "admin" || role === "staff") ? role : "staff";
  const gateId = assignedGateId && mongoose.Types.ObjectId.isValid(assignedGateId) ? assignedGateId : null;

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email: normalizedEmail,
    passwordHash,
    role: userRole,
    assignedGateId: gateId
  });

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
  const { name, email, role, assignedGateId } = req.body;
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (role === "admin" || role === "staff") user.role = role;
    
    if (assignedGateId !== undefined) {
      user.assignedGateId = assignedGateId && mongoose.Types.ObjectId.isValid(assignedGateId) ? assignedGateId : null;
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
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Safety check: Prevent users from deleting their own logged-in account
    if (user._id.toString() === req.user.id.toString()) {
      return res.status(400).json({ message: "You cannot delete your own admin account" });
    }

    await User.deleteOne({ _id: req.params.userId });
    return res.json({ message: "User account deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

