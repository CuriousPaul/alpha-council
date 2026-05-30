import {
  AlertTriangle,
  ArrowDown,
  BarChart3,
  Bell,
  CheckCircle2,
  Clipboard,
  Database,
  Gauge,
  Layers3,
  Play,
  Quote,
  RefreshCw,
  Save,
  Send,
  Target,
  Users,
  Vote
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CouncilVotes } from "./components/CouncilVotes";
import { ScoreDial } from "./components/ScoreDial";
import { SignalGrid } from "./components/SignalGrid";
import { getLatestReport, getTelegramAlertRule, readAnalysis, saveTelegramAlertRule, startAnalysis } from "./lib/api";
import type { Analysis, TelegramAlertRule } from "./lib/types";

const stateTone: Record<string, string> = {
  BULLISH: "toneBullish",
  NEUTRAL: "toneNeutral",
  BEARISH: "toneBearish",
  HIGH_RISK: "toneRisk"
};

const painPoints = [
  "온체인 지표는 많은데, 지금 시장 판단으로 번역하는 데 시간이 오래 걸립니다.",
  "단일 AI 요약은 빠르지만 상승론, 하락론, 리스크 관점의 균형을 확인하기 어렵습니다.",
  "고래 입금, 레버리지, MVRV, 스테이블코인 유동성을 매번 수동으로 묶어 봐야 합니다."
];

const personas = [
  {
    title: "Crypto Researcher",
    target: "매일 BTC/ETH 리스크를 해석하는 리서처",
    value: "근거 지표, 반대 신호, 최종 consensus를 한 화면에서 확인"
  },
  {
    title: "Active Trader",
    target: "단기 변동성 위험을 빠르게 점검하는 트레이더",
    value: "레버리지와 거래소 유입 기반의 24-72h risk label 확보"
  },
  {
    title: "Community Operator",
    target: "텔레그램/디스코드 시장 브리핑을 운영하는 리더",
    value: "한국어 요약과 알림 문구를 바로 공유 가능한 형태로 생성"
  }
];

const alternatives = [
  {
    method: "Chart dashboard",
    weakness: "지표는 풍부하지만 해석과 판단은 사용자가 직접 해야 함",
    alpha: "Signal Engine이 먼저 risk score와 watchpoint로 변환"
  },
  {
    method: "Single LLM report",
    weakness: "한 관점의 답변이라 편향과 과신 여부를 검증하기 어려움",
    alpha: "Bull, Bear, Risk, Smart Money, Narrative agent가 독립 투표"
  },
  {
    method: "Price alert",
    weakness: "가격 움직임 이후에 반응하고 원인 지표가 약하게 보임",
    alpha: "고래성 유입, 레버리지, 유동성 같은 선행 리스크를 함께 표시"
  },
  {
    method: "Manual daily note",
    weakness: "반복 작업이 많고 커뮤니티 공유용 문구를 다시 써야 함",
    alpha: "리포트, 근거, Telegram alert copy까지 한 번에 생성"
  }
];

const testimonials = [
  {
    quote: "기존엔 차트 세 개를 열어두고 제가 결론을 냈는데, 이제는 반대 관점까지 같이 보여줘서 회의 전에 바로 판단할 수 있어요.",
    name: "Hana",
    role: "Crypto Research Lead",
    point: "만족 포인트: 근거 지표와 counter-signal"
  },
  {
    quote: "단순히 위험하다고 말하는 게 아니라 누가 왜 High Risk에 투표했는지 보여주는 점이 좋았습니다.",
    name: "Minjun",
    role: "Active BTC Trader",
    point: "만족 포인트: agent vote distribution"
  },
  {
    quote: "커뮤니티 공지용으로 바로 붙여넣을 수 있는 한국어 알림 문구가 나와서 데일리 브리핑 시간이 확 줄었습니다.",
    name: "Sora",
    role: "Web3 Community Operator",
    point: "만족 포인트: 공유 가능한 요약"
  }
];

const apiPartners = [
  {
    name: "CryptoQuant",
    mark: "CQ",
    role: "On-chain and market data API"
  },
  {
    name: "cocoun",
    mark: "co",
    role: "AI Council and Poll API"
  }
];

function stateLabel(value?: string) {
  return value ? value.replace("_", " ") : "READY";
}

function telegramStatusText(rule: TelegramAlertRule) {
  if (!rule.enabled) return "Telegram alert paused";
  if (!rule.telegram_ready) return "Telegram alert active · demo delivery until bot credentials are set";
  return "Telegram alert active · delivery ready";
}

const defaultTelegramRule: TelegramAlertRule = {
  enabled: false,
  direction: "above",
  threshold: 75,
  chat_id: "",
  last_score: null,
  last_analysis_id: null,
  updated_at: null,
  telegram_ready: false
};

export function App() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [asset, setAsset] = useState("BTC");
  const [exchange, setExchange] = useState("all_exchange");
  const [timeframe, setTimeframe] = useState("24h");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [copied, setCopied] = useState(false);
  const [telegramRule, setTelegramRule] = useState<TelegramAlertRule>(defaultTelegramRule);
  const [telegramRuleStatus, setTelegramRuleStatus] = useState("Telegram alert not configured");

  const voteTotal = useMemo(() => {
    if (!analysis) return 0;
    return Object.values(analysis.vote_result).reduce((sum, value) => sum + value, 0);
  }, [analysis]);

  async function runAnalysis() {
    setLoading(true);
    setCopied(false);
    setStatus("Running council");
    try {
      const started = await startAnalysis({
        asset,
        exchange,
        timeframe,
        lookback_days: 90,
        telegram_alert_rule: {
          enabled: telegramRule.enabled,
          direction: telegramRule.direction,
          threshold: telegramRule.threshold,
          chat_id: telegramRule.chat_id,
          last_score: telegramRule.last_score
        }
      });
      let result: Analysis | null = null;
      if (started.status === "completed" || started.status === "failed") {
        result = started as Analysis;
      } else {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          const next = await readAnalysis(started.analysis_id);
          if (next.status === "completed" || next.status === "failed") {
            result = next;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 450));
        }
      }
      if (!result || result.status !== "completed") throw new Error("Analysis did not complete");
      setAnalysis(result);
      setStatus(result.source === "cryptoquant" ? "CryptoQuant live" : "Demo data mode");
      const nextRule = result.telegram_alert_rule || (await getTelegramAlertRule());
      setTelegramRule(nextRule);
      setTelegramRuleStatus(telegramStatusText(nextRule));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  }

  async function copyAlert() {
    if (!analysis) return;
    try {
      await navigator.clipboard.writeText(analysis.report.alert_text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = analysis.report.alert_text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function saveTelegramRule() {
    try {
      const saved = await saveTelegramAlertRule({
        enabled: telegramRule.enabled,
        direction: telegramRule.direction,
        threshold: telegramRule.threshold,
        chat_id: telegramRule.chat_id
      });
      setTelegramRule(saved);
      setTelegramRuleStatus(saved.enabled ? "Telegram alert rule saved" : "Telegram alert paused");
    } catch (error) {
      setTelegramRuleStatus(error instanceof Error ? error.message : "Failed to save Telegram alert rule");
    }
  }

  useEffect(() => {
    getTelegramAlertRule()
      .then((rule) => {
        setTelegramRule(rule);
        setTelegramRuleStatus(telegramStatusText(rule));
      })
      .catch(() => setTelegramRuleStatus("Telegram alert rule unavailable"));
    getLatestReport().then((latest) => {
      if (latest) setAnalysis(latest);
      else runAnalysis();
    });
  }, []);

  return (
    <main className="appShell">
      <section className="frontHero">
        <img src="/assets/alpha-council-hero.png" alt="" />
        <div className="heroOverlay" />
        <div className="heroContent">
          <div className="heroKicker">
            <Vote size={18} />
            Multi-agent consensus for crypto market intelligence
          </div>
          <h1>Alpha Council</h1>
          <p>
            온체인 데이터, 거래소 흐름, 고래 입금, 레버리지 신호를 여러 AI analyst가 독립적으로 해석하고
            투표해 24-72시간 BTC 리스크 판단으로 압축합니다.
          </p>
          <div className="heroActions">
            <a href="#demo" className="heroButton">
              <Play size={18} />
              Live demo
            </a>
            <a href="#comparison" className="heroGhostButton">
              <ArrowDown size={18} />
              Compare alternatives
            </a>
          </div>
          <div className="heroProof">
            <span>Demo result</span>
            <strong>HIGH RISK</strong>
            <span>78 / 100</span>
            <span>3 High Risk votes</span>
          </div>
          <div className="partnerStrip" aria-label="API partners">
            <span>Using APIs from</span>
            {apiPartners.map((partner) => (
              <div className="partnerLogo" key={partner.name}>
                <span className="partnerMark">{partner.mark}</span>
                <div>
                  <strong>{partner.name}</strong>
                  <small>{partner.role}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="preWowBand">
        <div className="preWowLead">
          <span className="eyebrow">Pre-wow moment</span>
          <h2>“BTC 지금 어때?”보다 중요한 질문은 “왜 그렇게 판단했나?”입니다.</h2>
          <p>
            Alpha Council은 데이터 대시보드와 챗봇 사이의 빈 공간을 채웁니다. 복잡한 지표를 리스크
            신호로 변환하고, 서로 다른 관점의 agent가 투표한 뒤, 최종 판단과 반대 신호를 함께 남깁니다.
          </p>
        </div>
        <div className="painList">
          {painPoints.map((pain) => (
            <div className="painItem" key={pain}>
              <AlertTriangle size={18} />
              <span>{pain}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="personaBand">
        <div className="sectionLead">
          <span className="eyebrow">Core targets</span>
          <h2>누구에게 가장 먼저 필요한가</h2>
        </div>
        <div className="personaGrid">
          {personas.map((persona) => (
            <article className="personaCard" key={persona.title}>
              <Target size={20} />
              <h3>{persona.title}</h3>
              <p>{persona.target}</p>
              <strong>{persona.value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="uspBand">
        <div className="uspBlock">
          <Gauge size={22} />
          <h3>Signal first</h3>
          <p>Raw metric을 z-score, 변화율, rule-based risk score로 먼저 정리합니다.</p>
        </div>
        <div className="uspBlock">
          <Users size={22} />
          <h3>Multi-agent vote</h3>
          <p>상승, 하락, 리스크, 스마트머니, 내러티브 관점을 분리해 편향을 낮춥니다.</p>
        </div>
        <div className="uspBlock">
          <Layers3 size={22} />
          <h3>Decision log</h3>
          <p>최종 라벨뿐 아니라 근거, confidence, counter-signal, 공유용 요약을 남깁니다.</p>
        </div>
      </section>

      <section className="comparisonBand" id="comparison">
        <div className="sectionLead">
          <span className="eyebrow">Alternative comparison</span>
          <h2>기존 방식이 놓치는 부분</h2>
        </div>
        <div className="comparisonTable" role="table" aria-label="Alternative comparison">
          <div className="comparisonRow comparisonHead" role="row">
            <span>Alternative</span>
            <span>Pain point</span>
            <span>Alpha Council</span>
          </div>
          {alternatives.map((item) => (
            <div className="comparisonRow" role="row" key={item.method}>
              <strong>{item.method}</strong>
              <span>{item.weakness}</span>
              <span className="alphaCell">
                <CheckCircle2 size={16} />
                {item.alpha}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="testimonialBand">
        <div className="sectionLead">
          <span className="eyebrow">Persona voices</span>
          <h2>주요 사용자들이 만족하는 순간</h2>
        </div>
        <div className="testimonialGrid">
          {testimonials.map((testimonial) => (
            <article className="testimonialCard" key={testimonial.name}>
              <Quote size={22} />
              <p>“{testimonial.quote}”</p>
              <div>
                <strong>{testimonial.name}</strong>
                <span>{testimonial.role}</span>
              </div>
              <em>{testimonial.point}</em>
            </article>
          ))}
        </div>
      </section>

      <header className="topBar" id="demo">
        <div>
          <div className="brandRow">
            <span className="brandMark">
              <Vote size={22} />
            </span>
            <div>
              <h2>Live Alpha Council</h2>
              <p>Run the BTC council and inspect the current market-risk report</p>
            </div>
          </div>
        </div>
        <div className={`stateBadge ${stateTone[analysis?.final_state || "NEUTRAL"]}`}>
          {stateLabel(analysis?.final_state)}
        </div>
      </header>

      <section className="controlBand">
        <label>
          Asset
          <select value={asset} onChange={(event) => setAsset(event.target.value)}>
            <option>BTC</option>
            <option disabled>ETH</option>
          </select>
        </label>
        <label>
          Exchange
          <select value={exchange} onChange={(event) => setExchange(event.target.value)}>
            <option value="all_exchange">all_exchange</option>
            <option value="binance">binance</option>
          </select>
        </label>
        <label>
          Timeframe
          <select value={timeframe} onChange={(event) => setTimeframe(event.target.value)}>
            <option value="24h">24h</option>
            <option value="7d">7d</option>
          </select>
        </label>
        <button className="primaryButton" onClick={runAnalysis} disabled={loading}>
          {loading ? <RefreshCw className="spin" size={18} /> : <Play size={18} />}
          Analyze
        </button>
        <span className="runStatus">
          <Database size={15} />
          {status}
        </span>
      </section>

      <section className="telegramRuleBand">
        <div className="sectionTitle">
          <Bell size={18} />
          <h2>Telegram Risk Alert</h2>
        </div>
        <div className="alertRuleGrid">
          <label className="toggleLabel">
            Enabled
            <button
              className={telegramRule.enabled ? "toggleButton active" : "toggleButton"}
              type="button"
              onClick={() => setTelegramRule((rule) => ({ ...rule, enabled: !rule.enabled }))}
              aria-pressed={telegramRule.enabled}
            >
              {telegramRule.enabled ? "On" : "Off"}
            </button>
          </label>
          <label>
            Trigger
            <select
              value={telegramRule.direction}
              onChange={(event) =>
                setTelegramRule((rule) => ({ ...rule, direction: event.target.value === "below" ? "below" : "above" }))
              }
            >
              <option value="above">Risk score rises above</option>
              <option value="below">Risk score falls below</option>
            </select>
          </label>
          <label>
            Score
            <input
              min="0"
              max="100"
              type="number"
              value={telegramRule.threshold}
              onChange={(event) =>
                setTelegramRule((rule) => ({ ...rule, threshold: Number(event.target.value || rule.threshold) }))
              }
            />
          </label>
          <label className="chatIdField">
            Telegram chat id
            <input
              placeholder="Optional if TELEGRAM_CHAT_ID is set"
              value={telegramRule.chat_id}
              onChange={(event) => setTelegramRule((rule) => ({ ...rule, chat_id: event.target.value }))}
            />
          </label>
          <button className="secondaryButton saveRuleButton" onClick={saveTelegramRule}>
            <Save size={17} />
            Save alert
          </button>
        </div>
        <div className="alertRuleStatus">
          <Send size={15} />
          <span>{telegramRuleStatus}</span>
          <span>
            Last score: {telegramRule.last_score ?? "none"} · Delivery: {telegramRule.telegram_ready ? "ready" : "demo mode"}
          </span>
        </div>
      </section>

      {analysis && (
        <>
          <section className="summaryBand">
            <div className="riskPanel">
              <div className="sectionTitle">
                <BarChart3 size={18} />
                <h2>Risk Score</h2>
              </div>
              <ScoreDial score={analysis.risk_score} label={analysis.final_state} />
              <div className="miniStats">
                <span>Confidence {Math.round(analysis.confidence * 100)}%</span>
                <span>{new Date(analysis.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} KST</span>
              </div>
            </div>

            <div className="votePanel">
              <div className="sectionTitle">
                <Vote size={18} />
                <h2>Vote Distribution</h2>
              </div>
              {Object.entries(analysis.vote_result).map(([key, value]) => (
                <div className="voteRow" key={key}>
                  <span>{key.replace("_", " ")}</span>
                  <div className="voteTrack">
                    <span style={{ width: `${voteTotal ? (value / voteTotal) * 100 : 0}%` }} />
                  </div>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>

          <SignalGrid signals={analysis.signalCards} />
          <CouncilVotes agents={analysis.agents} />

          <section className="reportBand">
            <div className="reportCopy">
              <div className="sectionTitle">
                <AlertTriangle size={18} />
                <h2>Final Report</h2>
              </div>
              <h3>Final Council Decision: {stateLabel(analysis.final_state)}</h3>
              <p>{analysis.report.summary_ko}</p>
              <ol>
                {analysis.report.top_reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ol>
              <small>{analysis.report.disclaimer}</small>
            </div>
            <div className="alertBox">
              <span>Telegram Alert</span>
              <p>{analysis.report.alert_text}</p>
              {analysis.telegram_alert && (
                <div className={`deliveryStatus delivery-${analysis.telegram_alert.status}`}>
                  <strong>
                    {analysis.telegram_alert.triggered
                      ? analysis.telegram_alert.status === "sent"
                        ? "Alert sent"
                        : "Alert triggered"
                      : "No alert sent"}
                  </strong>
                  <small>{analysis.telegram_alert.message || analysis.telegram_alert.reason}</small>
                </div>
              )}
              <button className="secondaryButton" onClick={copyAlert}>
                <Clipboard size={17} />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
