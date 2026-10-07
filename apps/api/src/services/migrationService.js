import { Company } from "../models/Company.js";
import { User } from "../models/User.js";
import { Event } from "../models/Event.js";

export async function runDataMigration() {
  try {
    // Check if there are users or events that need company assignment
    const unassignedUsers = await User.countDocuments({
      $or: [{ companyId: { $exists: false } }, { companyId: null }]
    });
    const unassignedEvents = await Event.countDocuments({
      $or: [{ companyId: { $exists: false } }, { companyId: null }]
    });
    const legacyRoleUsers = await User.countDocuments({
      role: { $in: ["admin", "staff"] }
    });

    if (unassignedUsers === 0 && unassignedEvents === 0 && legacyRoleUsers === 0) {
      return;
    }

    console.log("[Migration] Running automatic migration for company hierarchy and roles...");

    // 1. Find or create default company
    let defaultCompany = await Company.findOne({ slug: "default-organization" });
    if (!defaultCompany) {
      defaultCompany = await Company.create({
        name: "Default Organization",
        slug: "default-organization",
        email: "admin@example.com",
        phone: "",
        description: "Initial default company for migrated data",
        isActive: true
      });
      console.log(`[Migration] Created default company: ${defaultCompany.name} (${defaultCompany._id})`);
    }

    // 2. Migrate legacy roles to standard roles
    // First, convert legacy "admin" to "owner" if default company has no owner, else "event_admin"
    const legacyAdmins = await User.find({ role: "admin" }).sort({ createdAt: 1 });
    let isOwnerAssigned = false;

    // Check if defaultCompany already has an owner
    if (defaultCompany.ownerId) {
      const existingOwner = await User.findById(defaultCompany.ownerId);
      if (existingOwner && existingOwner.role === "owner") {
        isOwnerAssigned = true;
      }
    }

    for (const adminUser of legacyAdmins) {
      if (!isOwnerAssigned) {
        adminUser.role = "owner";
        isOwnerAssigned = true;
        defaultCompany.ownerId = adminUser._id;
        await defaultCompany.save();
        console.log(`[Migration] Promoted legacy admin ${adminUser.email} to owner of ${defaultCompany.name}`);
      } else {
        adminUser.role = "event_admin";
        console.log(`[Migration] Converted legacy admin ${adminUser.email} to event_admin`);
      }
      if (!adminUser.companyId) {
        adminUser.companyId = defaultCompany._id;
      }
      await adminUser.save();
    }

    // Convert legacy "staff" to "event_staff"
    const legacyStaff = await User.find({ role: "staff" });
    for (const staffUser of legacyStaff) {
      staffUser.role = "event_staff";
      if (!staffUser.companyId) {
        staffUser.companyId = defaultCompany._id;
      }
      await staffUser.save();
      console.log(`[Migration] Converted legacy staff ${staffUser.email} to event_staff`);
    }

    // 3. Assign companyId to any remaining unassigned users
    await User.updateMany(
      { $or: [{ companyId: { $exists: false } }, { companyId: null }] },
      { $set: { companyId: defaultCompany._id } }
    );

    // 4. Assign companyId to any remaining unassigned events
    await Event.updateMany(
      { $or: [{ companyId: { $exists: false } }, { companyId: null }] },
      { $set: { companyId: defaultCompany._id } }
    );

    // 5. Ensure default company has an owner assigned
    if (!defaultCompany.ownerId) {
      const firstOwner = await User.findOne({ companyId: defaultCompany._id, role: "owner" });
      if (firstOwner) {
        defaultCompany.ownerId = firstOwner._id;
        await defaultCompany.save();
      }
    }

    console.log("[Migration] Data migration to default company completed successfully.");
  } catch (error) {
    console.error("[Migration] Error during data migration:", error);
  }
}
