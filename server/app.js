import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import { fetchMarketData } from "./cryptoQuantClient.js";
import { analyzeSignals } from "./signalEngine.js";
import { runCouncil } from "./council.js";
import { createDefaultAlertRule, evaluateTelegramAlert, normalizeAlertRule } from "./telegram.js";

export const app = express();
const analyses = new Map();
let telegramAlertRule = createDefaultAlertRule();

app.use(cors());
app.use(express.json());

async function completeAnalysis(id, request) {
  try {
    const marketData = await fetchMarketData({
      asset: request.asset || "BTC",
      exchange: request.exchange || "all_exchange",
      lookbackDays: request.lookback_days || 90
    });
    const signalSummary = analyzeSignals(marketData);
    const council = runCouncil(signalSummary);
    const activeTelegramRule = request.telegram_alert_rule
      ? normalizeAlertRule(request.telegram_alert_rule, telegramAlertRule)
      : telegramAlertRule;
    telegramAlertRule = activeTelegramRule;
    const analysis = {
      analysis_id: id,
      status: "completed",
      created_at: new Date().toISOString(),
      source: marketData.source,
      warning: marketData.warning,
      ...signalSummary,
      ...council
    };
    const telegram_alert = await evaluateTelegramAlert(activeTelegramRule, analysis);
    telegramAlertRule = {
      ...activeTelegramRule,
      last_score: analysis.risk_score,
      last_analysis_id: id,
      updated_at: activeTelegramRule.updated_at || new Date().toISOString()
    };
    const completed = {
      ...analysis,
      telegram_alert,
      telegram_alert_rule: {
        ...telegramAlertRule,
        telegram_ready: Boolean(process.env.TELEGRAM_BOT_TOKEN && (telegramAlertRule.chat_id || process.env.TELEGRAM_CHAT_ID))
      }
    };
    analyses.set(id, completed);
    return completed;
  } catch (error) {
    const failed = {
      analysis_id: id,
      status: "failed",
      error: error instanceof Error ? error.message : "Analysis failed",
      created_at: new Date().toISOString()
    };
    analyses.set(id, failed);
    return failed;
  }
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "alpha-council-api" });
});

app.post("/api/analyze", async (req, res) => {
  const id = `ana_${randomUUID().slice(0, 8)}`;
  analyses.set(id, {
    analysis_id: id,
    status: "running",
    created_at: new Date().toISOString()
  });
  const analysis = await completeAnalysis(id, req.body || {});
  res.status(analysis.status === "failed" ? 500 : 200).json(analysis);
});

app.get("/api/analyze/:id", (req, res) => {
  const analysis = analyses.get(req.params.id);
  if (!analysis) return res.status(404).json({ error: "Analysis not found" });
  res.json(analysis);
});

app.get("/api/reports/latest", (_req, res) => {
  const completed = Array.from(analyses.values())
    .filter((analysis) => analysis.status === "completed")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  res.json(completed[0] || null);
});

app.post("/api/report/telegram-copy", (req, res) => {
  const alert = req.body?.report?.alert_text || "BTC Watch: 주요 시장 신호를 확인하세요.";
  res.json({ alert_text: alert });
});

app.get("/api/alerts/telegram", (_req, res) => {
  res.json({
    ...telegramAlertRule,
    telegram_ready: Boolean(process.env.TELEGRAM_BOT_TOKEN && (telegramAlertRule.chat_id || process.env.TELEGRAM_CHAT_ID))
  });
});

app.post("/api/alerts/telegram", (req, res) => {
  telegramAlertRule = normalizeAlertRule(req.body || {}, telegramAlertRule);
  res.json({
    ...telegramAlertRule,
    telegram_ready: Boolean(process.env.TELEGRAM_BOT_TOKEN && (telegramAlertRule.chat_id || process.env.TELEGRAM_CHAT_ID))
  });
});

export default app;
