import express from "express";
import bcrypt from "bcryptjs";
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
  const user = await User.findOne({ email: String(email).toLowerCase() });

  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = signToken(user);
  return res.json({ token, user: { id: user._id, name: user.name, email: user.email, role: user.role } });
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
  const users = await User.find({ role: "staff" }).sort({ createdAt: -1 }).lean();
  return res.json(users.map((user) => ({ id: user._id, name: user.name, email: user.email, role: user.role })));
});

authRouter.post("/staff", requireAuth, requireRole("admin"), async (req, res) => {
  const { name, email, password } = req.body;
  const normalizedEmail = String(email || "").toLowerCase();

  if (!name || !normalizedEmail || !password) {
    return res.status(400).json({ message: "name, email and password are required" });
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ message: "User already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email: normalizedEmail, passwordHash, role: "staff" });
  return res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role });
});

