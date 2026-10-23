import express from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { Company } from "../models/Company.js";
import { Event } from "../models/Event.js";
import { User } from "../models/User.js";

export const companyRouter = express.Router();
companyRouter.use(requireAuth);

/**
 * @openapi
 * /api/companies:
 *   get:
 *     tags: [Companies]
 *     summary: List all companies with aggregated stats (Super Admin only)
 *     security: [{bearerAuth: []}]
 *     responses:
 *       200:
 *         description: Array of companies with event and staff counts
 */
companyRouter.get("/", requireRole("super_admin"), async (req, res) => {
  try {
    const companies = await Company.find().sort({ name: 1 }).lean();
    const companyIds = companies.map((c) => c._id);

    const [eventCounts, staffCounts] = await Promise.all([
      Event.aggregate([
        { $match: { companyId: { $in: companyIds } } },
        { $group: { _id: "$companyId", count: { $sum: 1 } } }
      ]),
      User.aggregate([
        { $match: { companyId: { $in: companyIds } } },
        { $group: { _id: "$companyId", count: { $sum: 1 } } }
      ])
    ]);

    const eventCountMap = Object.fromEntries(
      eventCounts.map((e) => [e._id.toString(), e.count])
    );
    const staffCountMap = Object.fromEntries(
      staffCounts.map((s) => [s._id.toString(), s.count])
    );

    const enriched = companies.map((c) => ({
      _id: c._id,
      name: c.name,
      slug: c.slug,
      email: c.email,
      phone: c.phone || "",
      description: c.description || "",
      isActive: c.isActive,
      createdAt: c.createdAt,
      eventCount: eventCountMap[c._id.toString()] || 0,
      staffCount: staffCountMap[c._id.toString()] || 0
    }));

    return res.json(enriched);
  } catch (error) {
    console.error("Error in GET /api/companies:", error);
    return res.status(500).json({ message: error.message || "Failed to list companies" });
  }
});

/**
 * @openapi
 * /api/companies/{id}:
 *   get:
 *     tags: [Companies]
 *     summary: Get company by ID
 */
companyRouter.get("/:id", requireRole("super_admin"), async (req, res) => {
  try {
    const company = await Company.findById(req.params.id)
      .populate("ownerId", "name email phone")
      .lean();

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const [eventCount, staffCount] = await Promise.all([
      Event.countDocuments({ companyId: company._id }),
      User.countDocuments({ companyId: company._id })
    ]);

    return res.json({
      ...company,
      eventCount,
      staffCount
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to get company" });
  }
});
