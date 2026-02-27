import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import { query } from "../db/index.js";
import { getJwtSecret } from "../config.js";

const app = new Hono();

const RegisterBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Please enter your password"),
});

function createToken(userId: string, email: string): Promise<string> {
  const secret = new TextEncoder().encode(getJwtSecret());
  return new jose.SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

app.post("/register", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = RegisterBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }
  const { email, password } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2)
       RETURNING id`,
      [email.toLowerCase().trim(), passwordHash]
    );
    const user = result.rows[0];
    const token = await createToken(user.id, email);
    return c.json(
      { token, user: { id: user.id, email } },
      201
    );
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      return c.json({ error: "Email already in use" }, 409);
    }
    throw err;
  }
});

app.post("/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = LoginBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }
  const { email, password } = parsed.data;
  const emailNorm = email.toLowerCase().trim();

  const result = await query<{ id: string; password_hash: string }>(
    `SELECT id, password_hash FROM users WHERE email = $1`,
    [emailNorm]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const token = await createToken(user.id, emailNorm);
  return c.json({ token, user: { id: user.id, email: emailNorm } });
});

export default app;
