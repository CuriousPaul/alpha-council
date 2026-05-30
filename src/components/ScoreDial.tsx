type ScoreDialProps = {
  score: number;
  label: string;
};

export function ScoreDial({ score, label }: ScoreDialProps) {
  const angle = (Math.max(0, Math.min(score, 100)) / 100) * 180;

  return (
    <div className="scoreDial" aria-label={`Risk score ${score}`}>
      <div className="dialTrack">
        <div className="dialNeedle" style={{ transform: `rotate(${angle - 90}deg)` }} />
      </div>
      <div className="scoreValue">{score}</div>
      <div className="scoreMeta">
        <span>/ 100</span>
        <strong>{label.replace("_", " ")}</strong>
      </div>
    </div>
  );
}
