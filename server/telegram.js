const defaultRule = {
  enabled: false,
  direction: "above",
  threshold: 75,
  chat_id: "",
  last_score: null,
  last_analysis_id: null,
  updated_at: null
};

export function createDefaultAlertRule() {
  return { ...defaultRule };
}

export function normalizeAlertRule(input, currentRule = defaultRule) {
  const threshold = Number(input?.threshold);
  const direction = input?.direction === "below" ? "below" : "above";

  return {
    ...currentRule,
    enabled: Boolean(input?.enabled),
    direction,
    threshold: Number.isFinite(threshold) ? Math.max(0, Math.min(100, Math.round(threshold))) : currentRule.threshold,
    chat_id: typeof input?.chat_id === "string" ? input.chat_id.trim() : currentRule.chat_id,
    last_score: Number.isFinite(Number(input?.last_score)) ? Number(input.last_score) : currentRule.last_score,
    updated_at: new Date().toISOString()
  };
}

function isTriggered(rule, score) {
  if (!rule.enabled) return { triggered: false, reason: "Alert rule disabled" };

  const currentMatches = rule.direction === "above" ? score >= rule.threshold : score <= rule.threshold;
  if (rule.last_score === null || rule.last_score === undefined) {
    return {
      triggered: currentMatches,
      reason: currentMatches ? "Initial score matches alert rule" : "Initial score does not match alert rule"
    };
  }

  const crossed =
    rule.direction === "above"
      ? rule.last_score < rule.threshold && score >= rule.threshold
      : rule.last_score > rule.threshold && score <= rule.threshold;

  return {
    triggered: crossed,
    reason: crossed
      ? `Risk score crossed ${rule.direction === "above" ? "above" : "below"} ${rule.threshold}`
      : "No threshold crossing"
  };
}

function buildTelegramText(analysis, rule) {
  const directionText = rule.direction === "above" ? "rose above" : "fell below";
  const state = analysis.final_state.replace("_", " ");
  return [
    `Alpha Council Risk Alert`,
    `BTC risk score ${directionText} ${rule.threshold}: ${analysis.risk_score}/100 (${state})`,
    analysis.report.alert_text,
    `Confidence: ${Math.round(analysis.confidence * 100)}%`,
    analysis.report.disclaimer
  ].join("\n");
}

async function sendTelegramMessage(text, chatId) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !targetChatId) {
    return {
      status: "demo",
      delivered: false,
      message: "Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID, or enter a chat id in the UI, to send real Telegram alerts."
    };
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: targetChatId,
      text,
      disable_web_page_preview: true
    })
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      status: "failed",
      delivered: false,
      message: `Telegram send failed with ${response.status}: ${body.slice(0, 180)}`
    };
  }

  return {
    status: "sent",
    delivered: true,
    message: "Telegram alert sent"
  };
}

export async function evaluateTelegramAlert(rule, analysis) {
  const trigger = isTriggered(rule, analysis.risk_score);
  const text = buildTelegramText(analysis, rule);

  if (!trigger.triggered) {
    return {
      triggered: false,
      status: "skipped",
      delivered: false,
      reason: trigger.reason,
      text
    };
  }

  const delivery = await sendTelegramMessage(text, rule.chat_id);
  return {
    triggered: true,
    reason: trigger.reason,
    text,
    ...delivery
  };
}
