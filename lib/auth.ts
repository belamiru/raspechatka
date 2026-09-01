import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "raspechatka_admin_session";

function getSessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET не задана. Добавьте её в Environment Variables ONREZA."
    );
  }

  return new TextEncoder().encode(secret);
}

export function getAdminCookieName() {
  return COOKIE_NAME;
}

export async function createAdminSession() {
  return new SignJWT({
    role: "admin",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSessionSecret());
}

export async function isAdminSession(token?: string) {
  if (!token) {
    return false;
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecret());

    return payload.role === "admin";
  } catch {
    return false;
  }
}