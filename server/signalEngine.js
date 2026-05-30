const metricLabels = {
  btc_top10_inflow: "BTC Top10 Inflow",
  btc_exchange_netflow: "BTC Exchange Netflow",
  btc_exchange_reserve: "BTC Exchange Reserve",
  estimated_leverage_ratio: "Estimated Leverage Ratio",
  mvrv: "MVRV",
  stablecoin_exchange_reserve: "Stablecoin Exchange Reserve"
};

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
}

function stddev(values) {
  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance) || 1;
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

function latest(series) {
  return series[series.length - 1]?.value ?? 0;
}

function pctChange(series, periods) {
  const current = latest(series);
  const previous = series[Math.max(0, series.length - 1 - periods)]?.value || current;
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

function zScore(series) {
  const historical = series.slice(0, -1).map((point) => point.value);
  const current = latest(series);
  return (current - average(historical)) / stddev(historical);
}

function labelFromScore(score) {
  if (score >= 76) return "HIGH_RISK";
  if (score >= 56) return "BEARISH";
  if (score >= 31) return "NEUTRAL";
  return "BULLISH";
}

function severity(z, highThreshold, mediumThreshold = 1) {
  if (z >= highThreshold) return "HIGH";
  if (z >= mediumThreshold) return "MEDIUM";
  if (z <= -mediumThreshold) return "LOW";
  return "NEUTRAL";
}

export function analyzeSignals(marketData) {
  const metrics = marketData.metrics;
  const top10Z = zScore(metrics.btc_top10_inflow);
  const netflowZ = zScore(metrics.btc_exchange_netflow);
  const leverageZ = zScore(metrics.estimated_leverage_ratio);
  const mvrvNow = latest(metrics.mvrv);
  const stablecoinChange7d = pctChange(metrics.stablecoin_exchange_reserve, 7);

  let riskContribution = 0;
  if (top10Z > 2) riskContribution += 20;
  else if (top10Z > 1) riskContribution += 10;

  if (netflowZ > 2) riskContribution += 15;
  else if (netflowZ > 1) riskContribution += 8;

  if (leverageZ > 1.5) riskContribution += 20;
  else if (leverageZ > 0.8) riskContribution += 10;

  if (mvrvNow > 3.7) riskContribution += 20;
  else if (mvrvNow > 3.0) riskContribution += 10;
  else if (mvrvNow > 2.7) riskContribution += 6;

  if (stablecoinChange7d > 3) riskContribution -= 15;
  else if (stablecoinChange7d < -3) riskContribution += 10;

  let riskScore = 50 + Math.round(riskContribution * 0.44);
  riskScore = Math.max(0, Math.min(100, Math.round(riskScore)));

  const signals = {
    whale_pressure: severity(top10Z, 2),
    exchange_sell_pressure: severity(netflowZ, 2),
    leverage_heat: severity(leverageZ, 1.5, 0.8),
    valuation_heat: mvrvNow > 3.7 ? "HIGH" : mvrvNow > 2.7 ? "MEDIUM" : "NEUTRAL",
    stablecoin_liquidity: stablecoinChange7d > 3 ? "SUPPORTIVE" : stablecoinChange7d < -3 ? "LOW" : "NEUTRAL"
  };

  const market_state_preliminary = labelFromScore(riskScore);
  const signalCards = Object.entries(metrics).map(([key, series]) => ({
    key,
    label: metricLabels[key] || key,
    value: round(latest(series), key.includes("reserve") ? 0 : 2),
    change_24h: round(pctChange(series, 1), 2),
    change_7d: round(pctChange(series, 7), 2),
    z_score: round(zScore(series), 2)
  }));

  return {
    asset: marketData.asset,
    exchange: marketData.exchange,
    timeframe: "24h",
    risk_score: riskScore,
    market_state_preliminary,
    signals,
    signalCards,
    diagnostics: {
      top10_inflow_z_score: round(top10Z, 2),
      netflow_z_score: round(netflowZ, 2),
      leverage_z_score: round(leverageZ, 2),
      stablecoin_reserve_change_7d: round(stablecoinChange7d, 2),
      mvrv: round(mvrvNow, 2)
    }
  };
}
