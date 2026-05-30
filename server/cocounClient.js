const COCON_MCP_URL = process.env.COUNCIL_MCP_URL || "https://asia-northeast3-cocouns-v.cloudfunctions.net/mcp";

export function hasCocounKey() {
  return Boolean(process.env.COCOUN_API_KEY);
}

async function cocounRpc(method, params) {
  if (!process.env.COCOUN_API_KEY) {
    throw new Error("COCOUN_API_KEY is not configured");
  }

  const response = await fetch(COCON_MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "X-API-Key": process.env.COCOUN_API_KEY
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Math.floor(Math.random() * 1_000_000),
      method,
      params
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`cocoun MCP failed with ${response.status}: ${text.slice(0, 180)}`);
  }

  const payload = JSON.parse(text);
  if (payload.error) {
    throw new Error(payload.error.message || "cocoun MCP returned an error");
  }
  return payload.result;
}

async function callTool(name, args) {
  const result = await cocounRpc("tools/call", {
    name,
    arguments: args
  });
  const text = result?.content?.find((item) => item.type === "text")?.text;
  if (!text) return result;
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function compactSignals(signalSummary) {
  return [
    `risk_score=${signalSummary.risk_score}`,
    `state=${signalSummary.market_state_preliminary}`,
    `whale_pressure=${signalSummary.signals.whale_pressure}`,
    `exchange_sell_pressure=${signalSummary.signals.exchange_sell_pressure}`,
    `leverage_heat=${signalSummary.signals.leverage_heat}`,
    `valuation_heat=${signalSummary.signals.valuation_heat}`,
    `stablecoin_liquidity=${signalSummary.signals.stablecoin_liquidity}`
  ].join(", ");
}

async function predictLabel(label, signalSummary) {
  const labelText = label.replace("_", " ");
  return callTool("predictOpinion", {
    question: `Given these BTC market signals (${compactSignals(signalSummary)}), should BTC be classified as ${labelText} for the next 24-72 hours?`,
    segment: "crypto researchers and active BTC traders"
  });
}

function voteDistributionFromScores(scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const votes = { bullish: 0, neutral: 0, bearish: 0, high_risk: 0 };
  for (let index = 0; index < 5; index += 1) {
    const key = sorted[Math.min(index, sorted.length - 1)][0].toLowerCase();
    votes[key] += 1;
  }
  return votes;
}

export async function runCocounCouncil(signalSummary, localCouncil) {
  if (!hasCocounKey()) return { ...localCouncil, council_source: "local" };

  const labels = ["HIGH_RISK", "BEARISH", "NEUTRAL", "BULLISH"];
  const predictions = Object.fromEntries(
    await Promise.all(
      labels.map(async (label) => {
        const prediction = await predictLabel(label, signalSummary);
        return [label, prediction];
      })
    )
  );

  const scores = Object.fromEntries(
    labels.map((label) => [label, Number(predictions[label]?.agree ?? 0)])
  );
  const finalState = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || localCouncil.final_state;
  const topPrediction = predictions[finalState];
  const confidence = Math.max(localCouncil.confidence, Number(topPrediction?.confidence || 0) / 100);
  const vote_result = voteDistributionFromScores(scores);

  return {
    ...localCouncil,
    final_state: finalState,
    confidence: Number(Math.min(0.96, confidence).toFixed(2)),
    vote_result,
    council_source: "cocoun",
    cocoun: {
      predictions,
      scores,
      rationale: topPrediction?.rationale || ""
    },
    report: {
      ...localCouncil.report,
      summary_ko: topPrediction?.rationale
        ? `${localCouncil.report.summary_ko} cocoun 패널은 추가로 “${topPrediction.rationale}”라고 판단했습니다.`
        : localCouncil.report.summary_ko
    }
  };
}
