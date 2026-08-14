import mongoose from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Event } from "../models/Event.js";
import { Gate } from "../models/Gate.js";
import { EventAssignment } from "../models/EventAssignment.js";

export async function runAclBackfill() {
  console.log("[ACL Migration] Starting ACL Migration & Data Backfill...");

  // 1. Promote existing 'admin' users to 'super_admin'
  const adminRes = await User.updateMany({ role: "admin" }, { $set: { role: "super_admin" } });
  console.log(`[ACL Migration] Updated ${adminRes.modifiedCount} legacy 'admin' users to 'super_admin'.`);

  // 2. Promote existing 'staff' users to 'event_staff'
  const staffRes = await User.updateMany({ role: "staff" }, { $set: { role: "event_staff" } });
  console.log(`[ACL Migration] Updated ${staffRes.modifiedCount} legacy 'staff' users to 'event_staff'.`);

  // 3. Backfill EventCreator -> EventAssignment (event_admin)
  const events = await Event.find().lean();
  let eventAdminAssignments = 0;
  for (const event of events) {
    if (event.createdBy) {
      const res = await EventAssignment.updateOne(
        { userId: event.createdBy, eventId: event._id },
        { $setOnInsert: { role: "event_admin", assignedGateId: null } },
        { upsert: true }
      );
      if (res.upsertedCount > 0) eventAdminAssignments++;
    }
  }
  console.log(`[ACL Migration] Backfilled ${eventAdminAssignments} EventCreator assignments as 'event_admin'.`);

  // 4. Backfill Staff Gate assignments -> EventAssignment
  const staffUsers = await User.find({ assignedGateId: { $ne: null } }).lean();
  let eventStaffAssignments = 0;
  for (const staff of staffUsers) {
    const gate = await Gate.findById(staff.assignedGateId).lean();
    if (gate) {
      const res = await EventAssignment.updateOne(
        { userId: staff._id, eventId: gate.eventId },
        { $setOnInsert: { role: "event_staff", assignedGateId: gate._id } },
        { upsert: true }
      );
      if (res.upsertedCount > 0) eventStaffAssignments++;
    }
  }
  console.log(`[ACL Migration] Backfilled ${eventStaffAssignments} Staff Gate assignments as 'event_staff'.`);

  console.log("[ACL Migration] ACL Migration completed successfully.");
}

// Allow script execution directly via CLI
if (process.argv[1] && process.argv[1].endsWith("migrate-acl.js")) {
  mongoose
    .connect(env.mongoUri)
    .then(async () => {
      await runAclBackfill();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error("[ACL Migration] Migration failed:", err);
      process.exit(1);
    });
}
