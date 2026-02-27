import type { Context, Next } from "hono";
import * as jose from "jose";
import { getJwtSecret } from "../config.js";

type AuthEnv = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

export async function authMiddleware(c: Context<AuthEnv>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const secret = new TextEncoder().encode(getJwtSecret());
    const { payload } = await jose.jwtVerify(header.slice(7), secret);
    c.set("userId", payload.sub as string);
    c.set("userEmail", (payload.email as string) ?? "");
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
}
