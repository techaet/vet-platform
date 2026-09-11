import { describe, expect, it } from "vitest";

describe("Telegram secrets", () => {
  it("validates the configured bot token through getMe", async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN não está disponível no ambiente de teste");
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const body = await response.json() as { ok?: boolean };
    expect(response.ok).toBe(true);
    expect(body.ok).toBe(true);
  }, 15_000);
});
