import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Company } from "../models/Company.js";
import { Gate } from "../models/Gate.js";
import { Event } from "../models/Event.js";
import { EventAssignment } from "../models/EventAssignment.js";
import { signToken } from "../utils/jwt.js";
import { env } from "../config/env.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const authRouter = express.Router();

/**
 * @openapi
 * /api/auth/register-company:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new company with an Owner account
 */
authRouter.post("/register-company", async (req, res) => {
  const { companyName, name, email, password, phone } = req.body || {};
  const normalizedCompanyName = String(companyName || "").trim();
  const normalizedName = String(name || "").trim();
  const normalizedEmail = String(email || "").toLowerCase().trim();
  const rawPassword = String(password || "");
  const phoneStr = String(phone || "").trim();

  if (!normalizedCompanyName || !normalizedName || !normalizedEmail || !rawPassword) {
    return res.status(400).json({ message: "Company name, your name, email and password are required" });
  }

  // Check company uniqueness (case-insensitive)
  const escapedCompanyName = normalizedCompanyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const existingCompany = await Company.findOne({
    name: { $regex: new RegExp(`^${escapedCompanyName}$`, "i") }
  });
  if (existingCompany) {
    return res.status(409).json({ message: "A company with this name is already registered" });
  }

  // Check email uniqueness
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }

  const slugBase = normalizedCompanyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const companySlug = `${slugBase || "company"}-${Math.random().toString(36).slice(2, 7)}`;

  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const company = await Company.create({
    name: normalizedCompanyName,
    slug: companySlug,
    email: normalizedEmail,
    phone: phoneStr,
    isActive: true
  });

  const user = await User.create({
    companyId: company._id,
    name: normalizedName,
    email: normalizedEmail,
    passwordHash,
    phone: phoneStr,
    role: "owner"
  });

  company.ownerId = user._id;
  await company.save();

  const token = signToken(user);
  return res.status(201).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      company: {
        id: company._id,
        name: company.name,
        slug: company.slug
      }
    }
  });
});

/**
 * @openapi
 * /api/auth/setup-admin:
 *   post:
 *     tags: [Auth]
 *     summary: Bootstrap admin account
 */
authRouter.post("/setup-admin", async (req, res) => {
  const { setupKey, name, email, password } = req.body || {};

  if (setupKey !== env.adminSetupKey) {
    return res.status(403).json({ message: "Invalid setup key" });
  }

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "User already exists" });
  }

  let defaultCompany = await Company.findOne({ slug: "default-organization" });
  if (!defaultCompany) {
    defaultCompany = await Company.create({
      name: "Default Organization",
      slug: "default-organization",
      email: String(email).toLowerCase(),
      isActive: true
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    companyId: defaultCompany._id,
    name,
    email: String(email).toLowerCase(),
    passwordHash,
    role: "owner"
  });

  if (!defaultCompany.ownerId) {
    defaultCompany.ownerId = user._id;
    await defaultCompany.save();
  }

  const token = signToken(user);
  return res.status(201).json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: {
        id: defaultCompany._id,
        name: defaultCompany.name,
        slug: defaultCompany.slug
      }
    }
  });
});

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login and receive a JWT
 */
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }
  const user = await User.findOne({ email: String(email).toLowerCase() })
    .populate("companyId", "name slug")
    .populate("assignedGateId");

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
      phone: user.phone || "",
      role: user.role,
      company: user.companyId
        ? {
            id: user.companyId._id,
            name: user.companyId.name,
            slug: user.companyId.slug
          }
        : null,
      assignedGateId: user.assignedGateId?._id || null,
      assignedGateName: user.assignedGateId?.name || null
    }
  });
});

async function getManagedEventIdsForUser(userId, companyId) {
  const assignments = await EventAssignment.find({ userId, role: "event_admin" }).select("eventId").lean();
  const assignedEventIds = assignments.map((a) => a.eventId.toString());
  const createdEvents = await Event.find({ createdBy: userId, ...(companyId ? { companyId } : {}) }).select("_id").lean();
  const createdEventIds = createdEvents.map((e) => e._id.toString());
  return [...new Set([...assignedEventIds, ...createdEventIds])];
}

/**
 * @openapi
 * /api/auth/staff:
 *   get:
 *     tags: [Staff Management]
 *     summary: List users in the organization
 */
authRouter.get("/staff", requireAuth, requireRole("owner", "co_owner", "event_admin", "admin", "super_admin"), async (req, res) => {
  const currentRole = req.user.role;
  const currentUserId = req.user.id;
  const currentCompanyId = req.user.companyId;

  if (currentRole === "super_admin") {
    const users = await User.find()
      .populate("assignedGateId")
      .populate("companyId", "name")
      .sort({ createdAt: -1 })
      .lean();
    return res.json(
      users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone || "",
        role: u.role,
        companyName: u.companyId?.name || "",
        assignedGateId: u.assignedGateId?._id || null,
        assignedGateName: u.assignedGateId?.name || null
      }))
    );
  }

  if (currentRole === "owner" || currentRole === "co_owner" || currentRole === "admin") {
    // Owners and Co-Owners see all users in their company
    const users = await User.find({ companyId: currentCompanyId })
      .populate("assignedGateId")
      .sort({ createdAt: -1 })
      .lean();

    const userIds = users.map((u) => u._id);
    const assignments = await EventAssignment.find({ userId: { $in: userIds } })
      .populate("eventId", "title")
      .lean();

    const assignmentsByUser = {};
    for (const a of assignments) {
      const uid = a.userId.toString();
      if (!assignmentsByUser[uid]) assignmentsByUser[uid] = [];
      assignmentsByUser[uid].push({
        eventId: a.eventId?._id,
        eventTitle: a.eventId?.title,
        role: a.role
      });
    }

    return res.json(
      users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone || "",
        role: u.role,
        assignedGateId: u.assignedGateId?._id || null,
        assignedGateName: u.assignedGateId?.name || null,
        assignments: assignmentsByUser[u._id.toString()] || []
      }))
    );
  }

  if (currentRole === "event_admin") {
    // Event Admins see ONLY event_staff assigned to their managed events
    const managedEventIds = await getManagedEventIdsForUser(currentUserId, currentCompanyId);
    const staffAssignments = await EventAssignment.find({
      eventId: { $in: managedEventIds },
      role: "event_staff"
    }).select("userId eventId").populate("eventId", "title").lean();

    const staffUserIds = [...new Set(staffAssignments.map((a) => a.userId.toString()))];

    const users = await User.find({
      _id: { $in: staffUserIds },
      companyId: currentCompanyId,
      role: "event_staff"
    })
      .populate("assignedGateId")
      .sort({ createdAt: -1 })
      .lean();

    const assignmentsByUser = {};
    for (const a of staffAssignments) {
      const uid = a.userId.toString();
      if (!assignmentsByUser[uid]) assignmentsByUser[uid] = [];
      assignmentsByUser[uid].push({
        eventId: a.eventId?._id,
        eventTitle: a.eventId?.title,
        role: "event_staff"
      });
    }

    return res.json(
      users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone || "",
        role: u.role,
        assignedGateId: u.assignedGateId?._id || null,
        assignedGateName: u.assignedGateId?.name || null,
        assignments: assignmentsByUser[u._id.toString()] || []
      }))
    );
  }

  return res.status(403).json({ message: "Insufficient permissions" });
});

/**
 * @openapi
 * /api/auth/staff:
 *   post:
 *     tags: [Staff Management]
 *     summary: Create a user account in the organization
 */
authRouter.post("/staff", requireAuth, requireRole("owner", "co_owner", "event_admin", "admin", "super_admin"), async (req, res) => {
  const currentRole = req.user.role;
  const currentUserId = req.user.id;
  const currentCompanyId = req.user.companyId;
  const { name, email, password, phone, role, assignedGateId, assignedEventIds } = req.body || {};
  const normalizedEmail = String(email || "").toLowerCase().trim();

  if (!name || !normalizedEmail || !password) {
    return res.status(400).json({ message: "Name, email and password are required" });
  }

  // 1. Role Authorization Check
  if (currentRole === "co_owner") {
    if (role === "owner" || role === "co_owner") {
      return res.status(403).json({ message: "Only the Owner can create Co-Owners or Owners" });
    }
  } else if (currentRole === "event_admin") {
    if (role !== "event_staff") {
      return res.status(403).json({ message: "Event Admins can only create Event Staff accounts" });
    }
  }

  let targetRole = role;
  if (currentRole === "event_admin") {
    targetRole = "event_staff";
  } else if (currentRole === "co_owner") {
    targetRole = role === "event_admin" ? "event_admin" : "event_staff";
  } else {
    // Owner or super_admin
    const allowedRoles = ["co_owner", "event_admin", "event_staff"];
    targetRole = allowedRoles.includes(role) ? role : "event_staff";
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }

  const gateId = assignedGateId && mongoose.Types.ObjectId.isValid(assignedGateId) ? assignedGateId : null;

  if (gateId) {
    const gate = await Gate.findById(gateId).lean();
    if (!gate) {
      return res.status(404).json({ message: "Assigned gate not found" });
    }
    const gateEvent = await Event.findById(gate.eventId).lean();
    if (!gateEvent || gateEvent.companyId?.toString() !== currentCompanyId?.toString()) {
      return res.status(403).json({ message: "Gate does not belong to your company" });
    }
    if (currentRole === "event_admin") {
      const managedEventIds = await getManagedEventIdsForUser(currentUserId, currentCompanyId);
      if (!managedEventIds.includes(gate.eventId.toString())) {
        return res.status(403).json({ message: "Selected gate does not belong to your managed events" });
      }
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    companyId: currentCompanyId,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    phone: String(phone || "").trim(),
    role: targetRole,
    assignedGateId: gateId
  });

  // Handle assigned events if provided
  if (Array.isArray(assignedEventIds) && assignedEventIds.length > 0) {
    const validEvents = await Event.find({
      _id: { $in: assignedEventIds },
      companyId: currentCompanyId
    }).select("_id").lean();

    let validEventIds = validEvents.map((e) => e._id.toString());
    if (currentRole === "event_admin") {
      const managed = await getManagedEventIdsForUser(currentUserId, currentCompanyId);
      validEventIds = validEventIds.filter((id) => managed.includes(id));
    }

    const assignmentRole = targetRole === "event_admin" ? "event_admin" : "event_staff";
    for (const evId of validEventIds) {
      await EventAssignment.updateOne(
        { userId: user._id, eventId: evId },
        { $set: { role: assignmentRole, assignedGateId: gateId } },
        { upsert: true }
      );
    }
  } else if (gateId) {
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
    phone: populated.phone || "",
    role: populated.role,
    assignedGateId: populated.assignedGateId?._id || null,
    assignedGateName: populated.assignedGateId?.name || null
  });
});

/**
 * @openapi
 * /api/auth/staff/{userId}:
 *   put:
 *     tags: [Staff Management]
 *     summary: Update a user account in the organization
 */
authRouter.put("/staff/:userId", requireAuth, requireRole("owner", "co_owner", "event_admin", "admin", "super_admin"), async (req, res) => {
  const currentRole = req.user.role;
  const currentUserId = req.user.id;
  const currentCompanyId = req.user.companyId;
  const { name, email, phone, role, assignedGateId, assignedEventIds } = req.body || {};

  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (currentRole !== "super_admin" && user.companyId?.toString() !== currentCompanyId?.toString()) {
      return res.status(403).json({ message: "User does not belong to your organization" });
    }

    // Protection rule 1: Owner cannot be modified by anyone except the Owner themselves
    if (user.role === "owner" && currentUserId !== user._id.toString()) {
      return res.status(403).json({ message: "Only the Owner can edit the Owner account" });
    }

    // Protection rule 2: Co-Owners can only be edited by the Owner
    if (user.role === "co_owner" && currentRole !== "owner" && currentUserId !== user._id.toString()) {
      return res.status(403).json({ message: "Only the Owner can modify Co-Owner accounts" });
    }

    // Protection rule 3: Co-Owners cannot promote anyone to Owner or Co-Owner
    if (currentRole === "co_owner" && role && (role === "owner" || role === "co_owner")) {
      return res.status(403).json({ message: "Only the Owner can grant Owner or Co-Owner roles" });
    }

    // Protection rule 4: Event Admins can ONLY modify event_staff assigned to their events
    if (currentRole === "event_admin") {
      if (user.role !== "event_staff") {
        return res.status(403).json({ message: "Event Admins can only edit Event Staff accounts" });
      }
      if (role && role !== "event_staff") {
        return res.status(403).json({ message: "Event Admins cannot change roles" });
      }
    }

    if (name) user.name = name.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (phone !== undefined) user.phone = String(phone || "").trim();

    // Role update
    if (role && user.role !== "owner") {
      if (currentRole === "owner" || currentRole === "super_admin") {
        user.role = role;
      } else if (currentRole === "co_owner" && (role === "event_admin" || role === "event_staff")) {
        user.role = role;
      }
    }

    if (assignedGateId !== undefined) {
      const newGateId = assignedGateId && mongoose.Types.ObjectId.isValid(assignedGateId) ? assignedGateId : null;
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

    if (Array.isArray(assignedEventIds)) {
      const validEvents = await Event.find({
        _id: { $in: assignedEventIds },
        companyId: currentCompanyId
      }).select("_id").lean();

      let validIds = validEvents.map((e) => e._id.toString());
      if (currentRole === "event_admin") {
        const managed = await getManagedEventIdsForUser(currentUserId, currentCompanyId);
        validIds = validIds.filter((id) => managed.includes(id));
      }

      const assignmentRole = user.role === "event_admin" ? "event_admin" : "event_staff";
      for (const evId of validIds) {
        await EventAssignment.updateOne(
          { userId: user._id, eventId: evId },
          { $set: { role: assignmentRole } },
          { upsert: true }
        );
      }
    }

    await user.save();
    const updated = await User.findById(user._id).populate("assignedGateId");
    return res.json({
      id: updated._id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone || "",
      role: updated.role,
      assignedGateId: updated.assignedGateId?._id || null,
      assignedGateName: updated.assignedGateId?.name || null
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

/**
 * @openapi
 * /api/auth/staff/{userId}:
 *   delete:
 *     tags: [Staff Management]
 *     summary: Delete a user account in the organization
 */
authRouter.delete("/staff/:userId", requireAuth, requireRole("owner", "co_owner", "event_admin", "admin", "super_admin"), async (req, res) => {
  const currentRole = req.user.role;
  const currentUserId = req.user.id;
  const currentCompanyId = req.user.companyId;

  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (currentRole !== "super_admin" && user.companyId?.toString() !== currentCompanyId?.toString()) {
      return res.status(403).json({ message: "User does not belong to your organization" });
    }

    // Safety check: Cannot delete own account
    if (user._id.toString() === currentUserId.toString()) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }

    // Protection rule 1: Owner can NEVER be deleted
    if (user.role === "owner") {
      return res.status(403).json({ message: "The Owner account cannot be deleted" });
    }

    // Protection rule 2: Co-Owners can only be deleted by the Owner
    if (user.role === "co_owner" && currentRole !== "owner") {
      return res.status(403).json({ message: "Only the Owner can delete Co-Owner accounts" });
    }

    // Protection rule 3: Event Admins can only delete event_staff
    if (currentRole === "event_admin") {
      if (user.role !== "event_staff") {
        return res.status(403).json({ message: "Event Admins can only delete Event Staff accounts" });
      }
      const managedEventIds = await getManagedEventIdsForUser(currentUserId, currentCompanyId);
      const isAssigned = await EventAssignment.findOne({
        userId: user._id,
        eventId: { $in: managedEventIds }
      });
      if (!isAssigned) {
        return res.status(403).json({ message: "You can only delete staff assigned to your events" });
      }
    }

    await EventAssignment.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
    return res.json({ message: "User account deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
