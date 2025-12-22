// telegram-bot.ts - STUB
// Заглушка для модуля Telegram Bot.

export function startTelegramBot(): void {
  console.log("[STUB] Telegram Bot started.");
}

export function stopTelegramBot(): void {
  console.log("[STUB] Telegram Bot stopped.");
}

export async function getTelegramStatus(userId: string): Promise<{ linked: boolean; linkCode?: string }> {
  console.log(`[STUB] Getting Telegram status for user ${userId}`);
  return { linked: false };
}

export async function generateTelegramCode(userId: string): Promise<{ linkCode: string }> {
  console.log(`[STUB] Generating Telegram code for user ${userId}`);
  return { linkCode: "STUBCODE" };
}

export async function unlinkTelegram(userId: string): Promise<{ success: boolean }> {
  console.log(`[STUB] Unlinking Telegram for user ${userId}`);
  return { success: true };
}
