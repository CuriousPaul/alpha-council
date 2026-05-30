const voteRank = {
  BULLISH: 0,
  NEUTRAL: 1,
  BEARISH: 2,
  HIGH_RISK: 3
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function confidence(base, score) {
  return Number(clamp(base + Math.abs(score - 55) / 180, 0.58, 0.93).toFixed(2));
}

function voteDistribution(agents) {
  return agents.reduce(
    (acc, agent) => {
      acc[agent.vote.toLowerCase()] += 1;
      return acc;
    },
    { bullish: 0, neutral: 0, bearish: 0, high_risk: 0 }
  );
}

function topReasons(signalSummary) {
  const reasons = [];
  if (signalSummary.signals.whale_pressure === "HIGH") reasons.push("BTC top10 exchange inflow is elevated");
  if (signalSummary.signals.exchange_sell_pressure === "HIGH") reasons.push("BTC exchange netflow suggests sell-side pressure");
  if (signalSummary.signals.leverage_heat === "HIGH") reasons.push("Estimated leverage ratio indicates an over-leveraged market");
  if (signalSummary.signals.stablecoin_liquidity !== "SUPPORTIVE") {
    reasons.push("Stablecoin liquidity is not strong enough to offset sell-pressure signals");
  }
  if (signalSummary.signals.valuation_heat !== "NEUTRAL") reasons.push("MVRV is moving into a warmer valuation zone");
  return reasons.slice(0, 3);
}

function finalState(signalSummary, distribution) {
  const bearishOrRisk = distribution.bearish + distribution.high_risk;
  if (distribution.high_risk >= 3 && signalSummary.risk_score >= 70) return "HIGH_RISK";
  if (bearishOrRisk >= 3) return "BEARISH";
  if (distribution.bullish >= 3 && signalSummary.risk_score <= 45) return "BULLISH";
  return "NEUTRAL";
}

function makeAgents(signalSummary) {
  const score = signalSummary.risk_score;
  const s = signalSummary.signals;
  const bullVote = s.stablecoin_liquidity === "SUPPORTIVE" && score < 55 ? "BULLISH" : score > 72 ? "NEUTRAL" : "NEUTRAL";
  const bearVote = s.exchange_sell_pressure === "HIGH" || s.valuation_heat !== "NEUTRAL" || score > 68 ? "BEARISH" : "NEUTRAL";
  const riskVote = score >= 76 || s.leverage_heat === "HIGH" ? "HIGH_RISK" : score >= 56 ? "BEARISH" : "NEUTRAL";
  const smartVote = s.whale_pressure === "HIGH" && s.exchange_sell_pressure !== "LOW" ? "HIGH_RISK" : score >= 60 ? "BEARISH" : "NEUTRAL";
  const narrativeVote = score >= 76 ? "HIGH_RISK" : score >= 56 ? "BEARISH" : score >= 31 ? "NEUTRAL" : "BULLISH";

  return [
    {
      agent_name: "Bull Analyst",
      role: "Constructive signals",
      vote: bullVote,
      confidence: confidence(0.64, score),
      reasoning: [
        "Looks for liquidity support and cooling risk before turning bullish.",
        "Current stablecoin liquidity is not clearly expansionary.",
        "Bullish evidence is present only if exchange pressure cools."
      ],
      strongest_counter_signal: "Risk score remains elevated versus a clean bullish setup.",
      user_facing_comment_ko: "상승 관점에서는 유동성 개선이 필요하지만, 현재는 위험 신호가 먼저 보입니다."
    },
    {
      agent_name: "Bear Analyst",
      role: "Downside pressure",
      vote: bearVote,
      confidence: confidence(0.68, score),
      reasoning: [
        "Exchange-related pressure is the main bearish input.",
        "MVRV is warm enough to reduce margin of safety.",
        "If inflows persist, spot sell pressure can dominate."
      ],
      strongest_counter_signal: "Stablecoin liquidity is not deeply negative.",
      user_facing_comment_ko: "거래소 유입과 밸류에이션 부담이 겹쳐 하방 경계가 필요합니다."
    },
    {
      agent_name: "Risk Manager",
      role: "Volatility and liquidation",
      vote: riskVote,
      confidence: confidence(0.72, score),
      reasoning: [
        "Leverage heat is prioritized because it can amplify small moves.",
        "Positive netflow can increase near-term volatility.",
        "The score is above the high-risk operating threshold."
      ],
      strongest_counter_signal: "MVRV is elevated but not yet in an extreme top zone.",
      user_facing_comment_ko: "레버리지와 거래소 순유입이 동시에 높아 단기 변동성 위험이 큽니다."
    },
    {
      agent_name: "Smart Money Analyst",
      role: "Whale behavior",
      vote: smartVote,
      confidence: confidence(0.7, score),
      reasoning: [
        "Top10 inflow is treated as a whale-sized deposit proxy.",
        "Large exchange deposits can precede sell pressure or hedging.",
        "Reserve trends need confirmation before calling a durable reversal."
      ],
      strongest_counter_signal: "Exchange reserve is not sharply accelerating upward.",
      user_facing_comment_ko: "고래성 입금이 강하게 보이며, 실제 매도 압력으로 이어지는지 확인해야 합니다."
    },
    {
      agent_name: "Narrative Analyst",
      role: "User-facing synthesis",
      vote: narrativeVote,
      confidence: confidence(0.66, score),
      reasoning: [
        "The combined picture is better framed as risk classification than price prediction.",
        "Several signals point to volatility rather than a clean directional trend.",
        "The final report should preserve the strongest counter-signal."
      ],
      strongest_counter_signal: "Some metrics are warm but not at cycle-extreme levels.",
      user_facing_comment_ko: "현재 BTC는 방향성 확정보다 리스크 관리가 더 중요한 구간으로 보입니다."
    }
  ].sort((a, b) => voteRank[b.vote] - voteRank[a.vote]);
}

export function runCouncil(signalSummary) {
  const agents = makeAgents(signalSummary);
  const vote_result = voteDistribution(agents);
  const final_state = finalState(signalSummary, vote_result);
  const reasons = topReasons(signalSummary);
  const confidenceValue = Number(
    clamp(
      agents.reduce((sum, agent) => sum + agent.confidence, 0) / agents.length + signalSummary.risk_score / 600,
      0.62,
      0.94
    ).toFixed(2)
  );

  return {
    final_state,
    confidence: confidenceValue,
    vote_result,
    agents,
    report: {
      top_reasons: reasons,
      summary_ko:
        final_state === "HIGH_RISK"
          ? "현재 BTC 시장은 고래성 거래소 입금과 높은 레버리지 신호가 동시에 나타나 단기 변동성 위험이 높은 상태입니다."
          : "현재 BTC 시장은 일부 위험 신호가 있으나, 단기 방향성은 추가 확인이 필요한 상태입니다.",
      summary_en:
        final_state === "HIGH_RISK"
          ? "BTC is classified as high risk because whale-sized exchange inflows and elevated leverage are appearing together."
          : "BTC is mixed and needs more confirmation before a strong directional label.",
      alert_text:
        final_state === "HIGH_RISK"
          ? "BTC High Risk: 고래성 거래소 입금과 높은 레버리지 신호가 동시에 감지되어 단기 변동성 위험이 높습니다."
          : "BTC Watch: 주요 온체인 신호가 혼재되어 있어 추가 확인이 필요합니다.",
      disclaimer: "This is a research assistant output, not financial advice."
    }
  };
}
