export type MarketState = "BULLISH" | "NEUTRAL" | "BEARISH" | "HIGH_RISK";

export type SignalCard = {
  key: string;
  label: string;
  value: number;
  change_24h: number;
  change_7d: number;
  z_score: number;
};

export type AgentVote = {
  agent_name: string;
  role: string;
  vote: MarketState;
  confidence: number;
  reasoning: string[];
  strongest_counter_signal: string;
  user_facing_comment_ko: string;
};

export type TelegramAlertRule = {
  enabled: boolean;
  direction: "above" | "below";
  threshold: number;
  chat_id: string;
  last_score: number | null;
  last_analysis_id: string | null;
  updated_at: string | null;
  telegram_ready: boolean;
};

export type TelegramAlertResult = {
  triggered: boolean;
  status: "demo" | "failed" | "sent" | "skipped";
  delivered: boolean;
  reason: string;
  message?: string;
  text: string;
};

export type Analysis = {
  analysis_id: string;
  status: "running" | "completed" | "failed";
  created_at: string;
  source?: "demo" | "cryptoquant";
  warning?: string;
  asset: string;
  exchange: string;
  timeframe: string;
  risk_score: number;
  market_state_preliminary: MarketState;
  final_state: MarketState;
  confidence: number;
  signals: Record<string, string>;
  signalCards: SignalCard[];
  vote_result: {
    bullish: number;
    neutral: number;
    bearish: number;
    high_risk: number;
  };
  agents: AgentVote[];
  report: {
    top_reasons: string[];
    summary_ko: string;
    summary_en: string;
    alert_text: string;
    disclaimer: string;
  };
  telegram_alert?: TelegramAlertResult;
  telegram_alert_rule?: TelegramAlertRule;
};
