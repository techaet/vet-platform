import { describe, expect, it } from "vitest";

describe("Google OAuth secrets", () => {
  it("accepts the configured OAuth client credentials at the token endpoint", async () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error("Google OAuth secrets não estão disponíveis no ambiente de teste");
    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: "techvet-validation-code",
      grant_type: "authorization_code",
      redirect_uri: "https://vetplatform-alf9ll8o.manus.space/api/google/oauth/callback",
    });
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form,
    });
    const body = await response.json() as { error?: string };
    expect(response.status).not.toBe(401);
    expect(body.error).toBe("invalid_grant");
  }, 15_000);
});
