import { BadgeCheck, ShieldAlert } from "lucide-react";
import type { AgentVote } from "../lib/types";

const voteClass: Record<string, string> = {
  BULLISH: "voteBullish",
  NEUTRAL: "voteNeutral",
  BEARISH: "voteBearish",
  HIGH_RISK: "voteRisk"
};

export function CouncilVotes({ agents }: { agents: AgentVote[] }) {
  return (
    <section className="sectionBlock">
      <div className="sectionTitle">
        <BadgeCheck size={18} />
        <h2>AI Council Votes</h2>
      </div>
      <div className="agentGrid">
        {agents.map((agent) => (
          <article className="agentCard" key={agent.agent_name}>
            <div className="agentHead">
              <div>
                <h3>{agent.agent_name}</h3>
                <span>{agent.role}</span>
              </div>
              <div className={`votePill ${voteClass[agent.vote]}`}>{agent.vote.replace("_", " ")}</div>
            </div>
            <p>{agent.user_facing_comment_ko}</p>
            <div className="confidenceBar">
              <span style={{ width: `${agent.confidence * 100}%` }} />
            </div>
            <div className="agentFoot">
              <span>{Math.round(agent.confidence * 100)}% confidence</span>
              <span className="counterSignal">
                <ShieldAlert size={14} />
                {agent.strongest_counter_signal}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
