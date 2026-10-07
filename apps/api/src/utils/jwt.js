import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { env } from "../config/env.js";

export function extractCompanyId(val) {
  if (!val) return null;
  if (val instanceof mongoose.Types.ObjectId) {
    return val.toString();
  }
  if (typeof val === "object" && val._id) {
    return extractCompanyId(val._id);
  }
  const str = String(val);
  const match = str.match(/[0-9a-fA-F]{24}/);
  return match ? match[0] : null;
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
      companyId: extractCompanyId(user.companyId)
    },
    env.jwtSecret,
    { expiresIn: "12h" }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

