import type { Express, Request, Response } from "express";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { getOrganizationForUser, saveGoogleConnection } from "./db";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/gmail.send",
];

type GoogleState = { userId: number; organizationId: number; redirectUri: string };

function secretKey() {
  return scryptSync(ENV.cookieSecret || ENV.googleClientSecret, "techvet-google-token", 32);
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(part => part.toString("base64url")).join(".");
}

function baseUrl(req: Request) {
  return (ENV.appUrl || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
}

async function signState(state: GoogleState) {
  return new SignJWT(state as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(new TextEncoder().encode(ENV.cookieSecret));
}

async function verifyState(value: string) {
  const result = await jwtVerify(value, new TextEncoder().encode(ENV.cookieSecret));
  return result.payload as unknown as GoogleState;
}

export function registerGoogleOAuthRoutes(app: Express) {
  app.get("/api/google/oauth/start", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      const organizationId = Number(req.query.organizationId);
      if (!organizationId || !(await getOrganizationForUser(user.id, organizationId))) {
        res.status(403).send("Organização inválida.");
        return;
      }
      const redirectUri = `${baseUrl(req)}/api/google/oauth/callback`;
      const state = await signState({ userId: user.id, organizationId, redirectUri });
      const params = new URLSearchParams({ client_id: ENV.googleClientId, redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent", scope: GOOGLE_SCOPES.join(" "), state });
      res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
    } catch (error) {
      res.status(500).send(`Não foi possível iniciar a conexão Google: ${String(error)}`);
    }
  });

  app.get("/api/google/oauth/callback", async (req: Request, res: Response) => {
    try {
      const code = String(req.query.code || "");
      const stateValue = String(req.query.state || "");
      if (!code || !stateValue) { res.status(400).send("Código OAuth ausente."); return; }
      const state = await verifyState(stateValue);
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: ENV.googleClientId, client_secret: ENV.googleClientSecret, redirect_uri: state.redirectUri, grant_type: "authorization_code" }) });
      const tokens = await tokenResponse.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error?: string };
      if (!tokenResponse.ok || !tokens.access_token) throw new Error(tokens.error || "Google não retornou um token de acesso");
      const userResponse = await fetch(GOOGLE_USERINFO_URL, { headers: { authorization: `Bearer ${tokens.access_token}` } });
      const googleUser = await userResponse.json() as { email?: string };
      if (!userResponse.ok || !googleUser.email) throw new Error("Não foi possível identificar a conta Google autorizada");
      await saveGoogleConnection({ userId: state.userId, organizationId: state.organizationId, googleEmail: googleUser.email, accessTokenEncrypted: encrypt(tokens.access_token), refreshTokenEncrypted: tokens.refresh_token ? encrypt(tokens.refresh_token) : null, expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null, scopes: tokens.scope || GOOGLE_SCOPES.join(" ") });
      res.type("html").send("<h1>Google conectado</h1><p>Calendar e Gmail foram autorizados. Você pode fechar esta janela e voltar ao TechVet.</p>");
    } catch (error) {
      console.error("[Google OAuth] callback error", error);
      res.status(500).type("html").send(`<h1>Falha na conexão Google</h1><p>${String(error)}</p>`);
    }
  });
}
