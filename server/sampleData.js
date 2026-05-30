const days = 90;
const now = Date.now();

function series(base, trend, wave, spikeEvery = 0) {
  return Array.from({ length: days }, (_, index) => {
    const t = index / days;
    const cycle = Math.sin(index / 5.5) * wave + Math.cos(index / 13) * wave * 0.55;
    const spike = spikeEvery && index % spikeEvery === 0 ? wave * 2.3 : 0;
    return {
      date: new Date(now - (days - index - 1) * 86400000).toISOString(),
      value: Math.max(0, base + trend * t + cycle + spike)
    };
  });
}

const top10Inflow = series(6200, 2500, 900, 17);
const netflow = series(240, 1050, 480, 23).map((point, index) => ({
  ...point,
  value: point.value - (index % 9 === 0 ? 900 : 0)
}));
const reserve = series(2100000, -26000, 9000);
const leverage = series(0.275, 0.08, 0.024, 19);
const mvrv = series(2.12, 0.54, 0.13);
const stablecoinReserve = series(18500000000, -520000000, 180000000);

top10Inflow[top10Inflow.length - 1].value = 12800;
netflow[netflow.length - 1].value = 1420;
reserve[reserve.length - 1].value = 2072400;
leverage[leverage.length - 1].value = 0.42;
mvrv[mvrv.length - 1].value = 2.9;
stablecoinReserve[stablecoinReserve.length - 1].value = 17670000000;

export const sampleMarketData = {
  source: "demo",
  asset: "BTC",
  exchange: "all_exchange",
  generatedAt: new Date().toISOString(),
  metrics: {
    btc_top10_inflow: top10Inflow,
    btc_exchange_netflow: netflow,
    btc_exchange_reserve: reserve,
    estimated_leverage_ratio: leverage,
    mvrv,
    stablecoin_exchange_reserve: stablecoinReserve
  }
};
