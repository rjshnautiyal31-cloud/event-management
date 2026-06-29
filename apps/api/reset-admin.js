import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/event_qr_system";
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    passwordHash: String,
    role: String
});
const User = mongoose.model("User", userSchema);
async function run() {
    console.log("Connecting to:", mongoUri);
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");
    const users = await User.find({});
    if (users.length === 0) {
        console.log("No users found in database.");
    } else {
        console.log("Users in database:");
        users.forEach(u => {
            console.log(`- Name: ${u.name}, Email: ${u.email}, Role: ${u.role}`);
        });
    }
    const adminEmail = "admin@example.com";
    const newPassword = "admin123";
    const passwordHash = await bcrypt.hash(newPassword, 10);
    const admin = await User.findOne({ email: adminEmail });
    if (admin) {
        admin.passwordHash = passwordHash;
        await admin.save();
        console.log(`Reset password for existing admin (${adminEmail}) to '${newPassword}'`);
    } else {
        await User.create({
            name: "Admin",
            email: adminEmail,
            passwordHash: passwordHash,
            role: "admin"
        });
        console.log(`Created new admin (${adminEmail}) with password '${newPassword}'`);
    }
    await mongoose.disconnect();
}
run().catch(console.error);
