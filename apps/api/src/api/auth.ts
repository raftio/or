import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import { query } from "../db/index.js";
import { getJwtSecret } from "../config.js";

const app = new Hono();

const RegisterBodySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
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
  const { name, email, password } = parsed.data;
  const nameTrimmed = name.trim();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const result = await query<{ id: string }>(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
       RETURNING id`,
      [email.toLowerCase().trim(), nameTrimmed, passwordHash]
    );
    const user = result.rows[0];

    const slug = `personal-${user.id.slice(0, 8)}`;
    const wsResult = await query<{ id: string }>(
      `INSERT INTO workspaces (name, slug, owner_id) VALUES ($1, $2, $3) RETURNING id`,
      ["Personal", slug, user.id]
    );
    await query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [wsResult.rows[0].id, user.id]
    );

    const token = await createToken(user.id, email);
    return c.json(
      { token, user: { id: user.id, email, name: nameTrimmed } },
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

  const result = await query<{ id: string; name: string; password_hash: string }>(
    `SELECT id, name, password_hash FROM users WHERE email = $1`,
    [emailNorm]
  );
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  const token = await createToken(user.id, emailNorm);
  return c.json({ token, user: { id: user.id, email: emailNorm, name: user.name } });
});

app.get("/me", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const secret = new TextEncoder().encode(getJwtSecret());
    const { payload } = await jose.jwtVerify(auth.slice(7), secret);
    const userId = payload.sub as string;
    const result = await query<{ id: string; email: string; name: string }>(
      `SELECT id, email, name FROM users WHERE id = $1`,
      [userId]
    );
    const user = result.rows[0];
    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }
    return c.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
});

export default app;
