import { sampleMarketData } from "./sampleData.js";

const endpointMap = {
  btc_top10_inflow: "/v1/btc/exchange-flows/inflow",
  btc_exchange_netflow: "/v1/btc/exchange-flows/netflow",
  btc_exchange_reserve: "/v1/btc/exchange-flows/reserve",
  estimated_leverage_ratio: "/v1/btc/market-indicator/estimated-leverage-ratio",
  mvrv: "/v1/btc/market-indicator/mvrv",
  stablecoin_exchange_reserve: "/v1/stablecoin/exchange-flows/reserve"
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickMetricValue(metricName, row) {
  const candidates = {
    btc_top10_inflow: ["inflow_top10", "inflow_top_10", "top10_inflow", "value"],
    btc_exchange_netflow: ["netflow_total", "netflow", "value"],
    btc_exchange_reserve: ["reserve", "reserve_usd", "value"],
    estimated_leverage_ratio: ["estimated_leverage_ratio", "leverage_ratio", "value"],
    mvrv: ["mvrv", "mvrv_ratio", "value"],
    stablecoin_exchange_reserve: ["reserve", "reserve_usd", "value"]
  }[metricName];

  for (const key of candidates) {
    const value = toNumber(row[key]);
    if (value !== null) return value;
  }
  return null;
}

function normalizeRows(metricName, payload) {
  const rows = Array.isArray(payload?.result?.data)
    ? payload.result.data
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.result)
        ? payload.result
        : [];

  return rows
    .map((row, index) => ({
      date: row.date || row.datetime || row.timestamp || new Date(Date.now() - (rows.length - index) * 86400000).toISOString(),
      value: pickMetricValue(metricName, row)
    }))
    .filter((row) => row.value !== null)
    .slice(-90);
}

async function fetchMetric(metricName, options) {
  const baseUrl = process.env.CRYPTOQUANT_BASE_URL || "https://api.cryptoquant.com";
  const params = new URLSearchParams({
    exchange: options.exchange,
    window: "day",
    limit: String(options.lookbackDays || 90),
    format: "json"
  });

  const response = await fetch(`${baseUrl}${endpointMap[metricName]}?${params}`, {
    headers: {
      Authorization: `Bearer ${process.env.CRYPTOQUANT_API_KEY}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`CryptoQuant ${metricName} failed with ${response.status}`);
  }

  const payload = await response.json();
  const rows = normalizeRows(metricName, payload);
  if (rows.length < 14) throw new Error(`CryptoQuant ${metricName} returned too few rows`);
  return rows;
}

export async function fetchMarketData({ asset = "BTC", exchange = "all_exchange", lookbackDays = 90 } = {}) {
  if (!process.env.CRYPTOQUANT_API_KEY || asset !== "BTC") {
    return { ...sampleMarketData, asset, exchange, source: "demo", generatedAt: new Date().toISOString() };
  }

  try {
    const entries = await Promise.all(
      Object.keys(endpointMap).map(async (metricName) => [metricName, await fetchMetric(metricName, { exchange, lookbackDays })])
    );

    return {
      source: "cryptoquant",
      asset,
      exchange,
      generatedAt: new Date().toISOString(),
      metrics: Object.fromEntries(entries)
    };
  } catch (error) {
    return {
      ...sampleMarketData,
      asset,
      exchange,
      source: "demo",
      generatedAt: new Date().toISOString(),
      warning: error instanceof Error ? error.message : "CryptoQuant fetch failed"
    };
  }
}
