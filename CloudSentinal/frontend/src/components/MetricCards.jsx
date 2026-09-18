import { Cpu, CheckCircle2, History, Shield, Cloud, CloudLightning, CloudCheck, CloudRain } from "lucide-react";

export default function MetricCards({ tests, runs, confirmed, health }) {
  const totalRuns = runs.length;
  const passedRuns = runs.filter((r) => r.status === "passed").length;
  const failedRuns = runs.filter((r) => r.status === "failed").length;
  const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 100;

  return (
    <section className="metrics-grid">
      {/* Metric 1 */}
      <div className="metric-card cyan-tint">
        <div className="card-hud-corner tl" />
        <div className="card-hud-corner tr" />
        <div className="card-hud-corner bl" />
        <div className="card-hud-corner br" />

        <div className="metric-header">
          <div className="metric-title-group">
            <Cloud className="metric-cloud-mini" />
            <span className="metric-title">CLOUD SCENARIOS</span>
          </div>
          <div className="metric-icon-bg cyan">
            <Cpu className="metric-icon" />
          </div>
        </div>
        <div className="metric-value-row">
          <span className="metric-value">{tests.length}</span>
          <span className="metric-subtext">Active AWS Cloud Test Suites</span>
        </div>
        
        {/* Sparkline Visual */}
        <div className="sparkline-wrapper">
          <svg className="sparkline-svg" viewBox="0 0 100 25">
            <path
              d="M0,20 Q20,5 40,15 T80,8 T100,18"
              fill="none"
              stroke="var(--cyan-primary)"
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className="metric-bar-wrapper">
          <div className="metric-bar cyan" style={{ width: "100%" }} />
        </div>
      </div>

      {/* Metric 2 */}
      <div className="metric-card purple-tint">
        <div className="card-hud-corner tl" />
        <div className="card-hud-corner tr" />
        <div className="card-hud-corner bl" />
        <div className="card-hud-corner br" />

        <div className="metric-header">
          <div className="metric-title-group">
            <CloudLightning className="metric-cloud-mini" />
            <span className="metric-title">TOTAL RUNS</span>
          </div>
          <div className="metric-icon-bg purple">
            <History className="metric-icon" />
          </div>
        </div>
        <div className="metric-value-row">
          <span className="metric-value">{totalRuns}</span>
          <span className="metric-subtext">
            {passedRuns} Passed • {failedRuns} Failed
          </span>
        </div>

        <div className="sparkline-wrapper">
          <svg className="sparkline-svg" viewBox="0 0 100 25">
            <path
              d="M0,15 Q25,22 50,8 T75,18 T100,5"
              fill="none"
              stroke="var(--purple-accent)"
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className="metric-bar-wrapper">
          <div
            className="metric-bar purple"
            style={{ width: `${Math.min(totalRuns * 12, 100)}%` }}
          />
        </div>
      </div>

      {/* Metric 3 */}
      <div className="metric-card emerald-tint">
        <div className="card-hud-corner tl" />
        <div className="card-hud-corner tr" />
        <div className="card-hud-corner bl" />
        <div className="card-hud-corner br" />

        <div className="metric-header">
          <div className="metric-title-group">
            <CloudCheck className="metric-cloud-mini" />
            <span className="metric-title">CLOUD RESILIENCE</span>
          </div>
          <div className="metric-icon-bg emerald">
            <CheckCircle2 className="metric-icon" />
          </div>
        </div>
        <div className="metric-value-row">
          <span className="metric-value">{passRate}%</span>
          <span className="metric-subtext">Auto-recovery Cloud Success Rate</span>
        </div>

        <div className="sparkline-wrapper">
          <svg className="sparkline-svg" viewBox="0 0 100 25">
            <path
              d="M0,18 Q30,4 60,10 T90,2 T100,12"
              fill="none"
              stroke="var(--emerald-accent)"
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className="metric-bar-wrapper">
          <div className="metric-bar emerald" style={{ width: `${passRate}%` }} />
        </div>
      </div>

      {/* Metric 4 */}
      <div className={`metric-card ${confirmed ? "amber-tint" : "blue-tint"}`}>
        <div className="card-hud-corner tl" />
        <div className="card-hud-corner tr" />
        <div className="card-hud-corner bl" />
        <div className="card-hud-corner br" />

        <div className="metric-header">
          <div className="metric-title-group">
            <CloudRain className="metric-cloud-mini" />
            <span className="metric-title">CHAOS GUARD</span>
          </div>
          <div className={`metric-icon-bg ${confirmed ? "amber" : "blue"}`}>
            <Shield className="metric-icon" />
          </div>
        </div>
        <div className="metric-value-row">
          <span className={`metric-value ${confirmed ? "text-amber" : "text-blue"}`}>
            {confirmed ? "ARMED" : "LOCKED"}
          </span>
          <span className="metric-subtext">
            {confirmed ? "AWS Infrastructure Unlocked" : "Read-only Protection"}
          </span>
        </div>

        <div className="sparkline-wrapper">
          <svg className="sparkline-svg" viewBox="0 0 100 25">
            <path
              d="M0,12 Q20,20 50,5 T80,15 T100,8"
              fill="none"
              stroke={confirmed ? "var(--amber-accent)" : "var(--cyan-primary)"}
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className="metric-bar-wrapper">
          <div
            className={`metric-bar ${confirmed ? "amber" : "blue"}`}
            style={{ width: confirmed ? "100%" : "35%" }}
          />
        </div>
      </div>
    </section>
  );
}
