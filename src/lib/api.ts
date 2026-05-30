import type { Analysis, TelegramAlertRule } from "./types";

export async function startAnalysis(payload: {
  asset: string;
  exchange: string;
  timeframe: string;
  lookback_days: number;
  telegram_alert_rule?: Pick<TelegramAlertRule, "enabled" | "direction" | "threshold" | "chat_id" | "last_score">;
}) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to start analysis");
  return (await response.json()) as Analysis | { analysis_id: string; status: string };
}

export async function readAnalysis(id: string) {
  const response = await fetch(`/api/analyze/${id}`);
  if (!response.ok) throw new Error("Failed to read analysis");
  return (await response.json()) as Analysis;
}

export async function getLatestReport() {
  const response = await fetch("/api/reports/latest?asset=BTC");
  if (!response.ok) return null;
  return (await response.json()) as Analysis | null;
}

export async function getTelegramAlertRule() {
  const response = await fetch("/api/alerts/telegram");
  if (!response.ok) throw new Error("Failed to load Telegram alert rule");
  return (await response.json()) as TelegramAlertRule;
}

export async function saveTelegramAlertRule(payload: Pick<TelegramAlertRule, "enabled" | "direction" | "threshold" | "chat_id">) {
  const response = await fetch("/api/alerts/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error("Failed to save Telegram alert rule");
  return (await response.json()) as TelegramAlertRule;
}
