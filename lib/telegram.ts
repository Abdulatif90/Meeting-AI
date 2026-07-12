import "server-only";

// Telegram HTML parse_mode faqat <, >, & belgilarini escape qilishni talab qiladi
function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatTime(date: Date): string {
  return date.toLocaleString("uz-UZ", {
    timeZone: "Asia/Seoul",
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export async function sendTelegramMessage(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    console.warn(
      "[telegram] TELEGRAM_BOT_TOKEN yoki TELEGRAM_ADMIN_CHAT_ID .env da yo'q — xabar yuborilmadi"
    );
    return;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[telegram] failed to send: ${res.status} ${body}`);
    }
  } catch (error) {
    console.error("[telegram] failed to send:", error);
  }
}

export async function sendNewUserNotification(params: {
  name: string;
  email: string;
  createdAt: Date;
}): Promise<void> {
  await sendTelegramMessage(
    [
      "🆕 <b>Yangi user ro'yxatdan o'tdi</b>",
      `👤 Ism: ${escapeHtml(params.name)}`,
      `📧 Email: ${escapeHtml(params.email)}`,
      `🕐 Vaqt: ${formatTime(params.createdAt)}`,
    ].join("\n")
  );
}

export async function sendSignInNotification(params: {
  name: string;
  email: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}): Promise<void> {
  await sendTelegramMessage(
    [
      "✅ <b>Tizimga kirish</b>",
      `👤 Ism: ${escapeHtml(params.name)}`,
      `📧 Email: ${escapeHtml(params.email)}`,
      `🌐 IP: ${escapeHtml(params.ipAddress || "noma'lum")}`,
      `💻 Qurilma: ${escapeHtml(params.userAgent || "noma'lum")}`,
      `🕐 Vaqt: ${formatTime(params.createdAt)}`,
    ].join("\n")
  );
}
