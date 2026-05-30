import { Activity, TrendingDown, TrendingUp } from "lucide-react";
import type { SignalCard } from "../lib/types";

function compactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: Math.abs(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 10000 ? 1 : 2
  }).format(value);
}

export function SignalGrid({ signals }: { signals: SignalCard[] }) {
  return (
    <section className="sectionBlock">
      <div className="sectionTitle">
        <Activity size={18} />
        <h2>Market Signals</h2>
      </div>
      <div className="signalGrid">
        {signals.map((signal) => {
          const positive = signal.change_24h >= 0;
          const TrendIcon = positive ? TrendingUp : TrendingDown;
          return (
            <article className="signalCard" key={signal.key}>
              <div>
                <p>{signal.label}</p>
                <strong>{compactNumber(signal.value)}</strong>
              </div>
              <div className={positive ? "metricDelta up" : "metricDelta down"}>
                <TrendIcon size={16} />
                {positive ? "+" : ""}
                {signal.change_24h.toFixed(2)}%
              </div>
              <div className="signalFoot">
                <span>7d {signal.change_7d >= 0 ? "+" : ""}{signal.change_7d.toFixed(2)}%</span>
                <span>Z {signal.z_score.toFixed(2)}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
