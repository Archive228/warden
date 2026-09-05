import { assertRejects } from "@std/assert";
import { sendTelegramAlert } from "./telegram.ts";

// This environment has no TELEGRAM_BOT_TOKEN/CHAT_ID (no Telegram bot has
// been created for this project). This proves the failure mode is a clean,
// specific error, not a crash - the actual "message arrives in Telegram"
// behavior is unverified until someone configures a real bot, see
// claude-progress.txt.
Deno.test("sendTelegramAlert fails clearly, not silently, without credentials", async () => {
  const savedToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const savedChatId = Deno.env.get("TELEGRAM_CHAT_ID");
  Deno.env.delete("TELEGRAM_BOT_TOKEN");
  Deno.env.delete("TELEGRAM_CHAT_ID");
  try {
    await assertRejects(
      () => sendTelegramAlert("test"),
      Error,
      "TELEGRAM_BOT_TOKEN",
    );
  } finally {
    if (savedToken) Deno.env.set("TELEGRAM_BOT_TOKEN", savedToken);
    if (savedChatId) Deno.env.set("TELEGRAM_CHAT_ID", savedChatId);
  }
});
