import { sampleMarketData } from "./sampleData.js";
import { callApiFuse, hasApiFuseKey } from "./apiFuseClient.js";

const endpointMap = {
  btc_top10_inflow: "/v1/btc/exchange-flows/inflow",
  btc_exchange_netflow: "/v1/btc/exchange-flows/netflow",
  btc_exchange_reserve: "/v1/btc/exchange-flows/reserve",
  estimated_leverage_ratio: "/v1/btc/market-indicator/estimated-leverage-ratio",
  mvrv: "/v1/btc/market-indicator/mvrv",
  stablecoin_exchange_reserve: "/v1/stablecoin/exchange-flows/reserve"
};

const apiFuseOperationMap = {
  btc_top10_inflow: process.env.APIFUSE_CQ_BTC_TOP10_INFLOW_OPERATION || "btc-exchange-flows-inflow",
  btc_exchange_netflow: process.env.APIFUSE_CQ_BTC_NETFLOW_OPERATION || "btc-exchange-flows-netflow",
  btc_exchange_reserve: process.env.APIFUSE_CQ_BTC_RESERVE_OPERATION || "btc-exchange-flows-reserve",
  estimated_leverage_ratio:
    process.env.APIFUSE_CQ_ESTIMATED_LEVERAGE_RATIO_OPERATION || "btc-market-indicator-estimated-leverage-ratio",
  mvrv: process.env.APIFUSE_CQ_MVRV_OPERATION || "btc-market-indicator-mvrv",
  stablecoin_exchange_reserve:
    process.env.APIFUSE_CQ_STABLECOIN_RESERVE_OPERATION || "stablecoin-exchange-flows-reserve"
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
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-90);
}

async function fetchMetricSet(metricNames, fetcher, options) {
  const results = await Promise.allSettled(metricNames.map(async (metricName) => [metricName, await fetcher(metricName, options)]));
  const entries = [];
  const warnings = [];
  let liveCount = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      entries.push(result.value);
      liveCount += 1;
    } else {
      const metricName = metricNames[entries.length + warnings.length];
      entries.push([metricName, sampleMarketData.metrics[metricName]]);
      warnings.push(result.reason instanceof Error ? result.reason.message : `${metricName} fetch failed`);
    }
  }

  return {
    metrics: Object.fromEntries(entries),
    liveCount,
    warnings
  };
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
    const body = await response.text();
    throw new Error(`CryptoQuant ${metricName} failed with ${response.status}: ${body.slice(0, 120)}`);
  }

  const payload = await response.json();
  const rows = normalizeRows(metricName, payload);
  if (rows.length < 14) throw new Error(`CryptoQuant ${metricName} returned too few rows`);
  return rows;
}

async function fetchApiFuseMetric(metricName, options) {
  const providerId = process.env.APIFUSE_CRYPTOQUANT_PROVIDER_ID || "cryptoquant";
  const operationId = apiFuseOperationMap[metricName];
  const payload = {
    asset: "BTC",
    exchange: options.exchange,
    window: "day",
    limit: options.lookbackDays || 90,
    format: "json"
  };

  const result = await callApiFuse(providerId, operationId, payload);
  const rows = normalizeRows(metricName, result);
  if (rows.length < 14) throw new Error(`ApiFuse ${metricName} returned too few rows`);
  return rows;
}

export async function fetchMarketData({ asset = "BTC", exchange = "all_exchange", lookbackDays = 90 } = {}) {
  const warningNotes = [];

  if (hasApiFuseKey() && asset === "BTC") {
    try {
      const metricNames = Object.keys(apiFuseOperationMap);
      const fetched = await fetchMetricSet(metricNames, fetchApiFuseMetric, { exchange, lookbackDays });

      if (fetched.liveCount > 0) {
        return {
          source: fetched.liveCount === metricNames.length ? "apifuse" : "apifuse_partial",
          asset,
          exchange,
          generatedAt: new Date().toISOString(),
          metrics: fetched.metrics,
          warning: fetched.warnings.join(" | ") || undefined
        };
      }
      warningNotes.push(fetched.warnings.join(" | ") || "ApiFuse CryptoQuant gateway returned no live metrics");
    } catch (error) {
      warningNotes.push(error instanceof Error ? error.message : "ApiFuse CryptoQuant gateway failed");
    }
  }

  if (!process.env.CRYPTOQUANT_API_KEY || asset !== "BTC") {
    return {
      ...sampleMarketData,
      asset,
      exchange,
      source: "demo",
      generatedAt: new Date().toISOString(),
      warning: warningNotes.filter(Boolean).join(" | ") || undefined
    };
  }

  try {
    const metricNames = Object.keys(endpointMap);
    const fetched = await fetchMetricSet(metricNames, fetchMetric, { exchange, lookbackDays });

    if (fetched.liveCount > 0) {
      return {
        source: fetched.liveCount === metricNames.length ? "cryptoquant" : "cryptoquant_partial",
        asset,
        exchange,
        generatedAt: new Date().toISOString(),
        metrics: fetched.metrics,
        warning: [...warningNotes, ...fetched.warnings].filter(Boolean).join(" | ") || undefined
      };
    }

    warningNotes.push(...fetched.warnings);
  } catch (error) {
    warningNotes.push(error instanceof Error ? error.message : "CryptoQuant fetch failed");
  }

  return {
    ...sampleMarketData,
    asset,
    exchange,
    source: "demo",
    generatedAt: new Date().toISOString(),
    warning: warningNotes.filter(Boolean).join(" | ") || undefined
  };
}
