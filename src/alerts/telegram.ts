// Sending an alert is one POST request. A whole bot-framework dependency
// (this project already removed one for pulling deprecated transitive
// deps for a feature that didn't exist yet) buys nothing warden needs -
// it never receives updates, only sends them.
export async function sendTelegramAlert(text: string): Promise<void> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chatId) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env",
    );
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${body}`);
  }
}
