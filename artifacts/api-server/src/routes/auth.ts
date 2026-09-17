import {
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  GetCurrentAuthUserResponse,
  LogoutMobileSessionResponse,
} from "@workspace/api-zod";
import { db, staff, usersTable } from "@workspace/db";
import { and, eq, isNull, isNotNull } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import * as oidc from "openid-client";
import {
  clearSession,
  createSession,
  deleteSession,
  getOidcConfig,
  getSessionId,
  ISSUER_URL,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;
const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

async function upsertUser(claims: Record<string, unknown>) {
  const userData = {
    id: claims.sub as string,
    email: (claims.email as string) || null,
    firstName: (claims.first_name as string) || null,
    lastName: (claims.last_name as string) || null,
    profileImageUrl: (claims.profile_image_url || claims.picture) as string | null,
  };
  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: { ...userData, updatedAt: new Date() },
    })
    .returning();
  return user;
}

async function linkStaffAccount(user: {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}) {
  if (user.email) {
    const [matchingStaff] = await db
      .select({ id: staff.id })
      .from(staff)
      .where(and(eq(staff.email, user.email), isNull(staff.authUserId)))
      .limit(1);
    if (matchingStaff) {
      await db
        .update(staff)
        .set({ authUserId: user.id, status: "active", lastActiveAt: new Date(), updatedAt: new Date() })
        .where(eq(staff.id, matchingStaff.id));
      return;
    }
  }

  const [linkedStaff] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(eq(staff.authUserId, user.id))
    .limit(1);
  if (linkedStaff) {
    await db.update(staff).set({ lastActiveAt: new Date() }).where(eq(staff.id, linkedStaff.id));
    return;
  }

  const [anyLinkedStaff] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(isNotNull(staff.authUserId))
    .limit(1);
  if (!anyLinkedStaff && user.email) {
    await db.insert(staff).values({
      id: `staff-auth-${user.id}`,
      authUserId: user.id,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
      email: user.email,
      phone: "Not provided",
      role: "administrator",
      branchId: null,
      status: "active",
      joinedAt: new Date(),
      lastActiveAt: new Date(),
    });
  }
}

async function createAuthSession(
  claims: Record<string, unknown>,
  tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers,
) {
  const dbUser = await upsertUser(claims);
  await linkStaffAccount(dbUser);
  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
      expires_at: tokens.expiresIn()
        ? now + tokens.expiresIn()!
        : typeof claims.exp === "number"
          ? claims.exp
          : undefined,
  };
  return createSession(sessionData);
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(GetCurrentAuthUserResponse.parse({
    user: req.isAuthenticated() ? req.user : null,
  }));
});

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });
  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", getSafeReturnTo(req.query.returnTo));
  res.redirect(redirectTo.href);
});

router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;
  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;
  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }
  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );
  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }
  const returnTo = getSafeReturnTo(req.cookies?.return_to);
  for (const cookie of ["code_verifier", "nonce", "state", "return_to"]) {
    res.clearCookie(cookie, { path: "/" });
  }
  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }
  const sid = await createAuthSession(claims as unknown as Record<string, unknown>, tokens);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

router.get("/logout", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const origin = getOrigin(req);
  const returnTo = getSafeReturnTo(req.query.returnTo);
  const postLogoutRedirectUrl = new URL(returnTo, `${origin}/`).href;
  await clearSession(res, getSessionId(req));
  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: postLogoutRedirectUrl,
  });
  res.redirect(endSessionUrl.href);
});

router.post("/mobile-auth/token-exchange", async (req: Request, res: Response) => {
  const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required parameters" });
    return;
  }
  const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;
  try {
    const config = await getOidcConfig();
    const callbackUrl = new URL(redirect_uri);
    callbackUrl.searchParams.set("code", code);
    callbackUrl.searchParams.set("state", state);
    callbackUrl.searchParams.set("iss", ISSUER_URL);
    const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
      pkceCodeVerifier: code_verifier,
      expectedNonce: nonce ?? undefined,
      expectedState: state,
      idTokenExpected: true,
    });
    const claims = tokens.claims();
    if (!claims) {
      res.status(401).json({ error: "No claims in ID token" });
      return;
    }
    const sid = await createAuthSession(claims as unknown as Record<string, unknown>, tokens);
    res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
  } catch {
    res.status(500).json({ error: "Token exchange failed" });
  }
});

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) await deleteSession(sid);
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;