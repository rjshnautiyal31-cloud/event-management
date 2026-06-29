import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      email: user.email
    },
    env.jwtSecret,
    { expiresIn: "12h" }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

