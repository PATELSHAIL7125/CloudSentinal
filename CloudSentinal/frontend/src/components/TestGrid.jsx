import { useState } from "react";
import {
  Cloud,
  CloudLightning,
  CloudOff,
  CloudRain,
  CloudCheck,
  ServerOff,
  Trash2,
  Network,
  RotateCw,
  TrendingDown,
  Cpu,
  ShieldAlert,
  Search,
  Play,
  Zap,
  Sparkles,
  Info,
  Radio,
} from "lucide-react";
import { soundFX } from "../utils/audio";

export const TEST_METADATA = {
  "stop-ec2": {
    title: "Stop EC2 Compute Node",
    category: "Compute",
    danger: "Medium",
    duration: "~45s",
    icon: CloudOff,
    description: "Stops one AWS Cloud Auto Scaling instance to verify automatic health replacement & continuous traffic routing.",
    target: "AWS EC2 Cloud Node",
    tags: ["AWS Cloud", "EC2", "AutoScaling", "SelfHealing"],
  },
  "terminate-ec2": {
    title: "Terminate Cloud Instance",
    category: "Compute",
    danger: "High",
    duration: "~60s",
    icon: Trash2,
    description: "Permanently terminates an active AWS compute instance and checks desired capacity auto-recreation.",
    target: "EC2 Cloud Instance",
    tags: ["AWS Cloud", "Termination", "EC2"],
  },
  "detach-lb": {
    title: "Detach Cloud Load Balancer Target",
    category: "Networking",
    danger: "Medium",
    duration: "~30s",
    icon: Cloud,
    description: "Deregisters a target from the ALB Cloud target group and measures seamless HTTP request failover.",
    target: "AWS ALB Ingress",
    tags: ["AWS Cloud", "ALB", "TargetGroup", "Failover"],
  },
  "reboot-ec2": {
    title: "Reboot Compute Node",
    category: "Compute",
    danger: "Low",
    duration: "~25s",
    icon: RotateCw,
    description: "Reboots a single active host while running continuous synthetic health checks to verify zero downtime.",
    target: "EC2 Host Node",
    tags: ["AWS Cloud", "Reboot", "SyntheticCheck"],
  },
  "scale-asg": {
    title: "Force Cloud Scale Down",
    category: "Scaling",
    danger: "High",
    duration: "~90s",
    icon: TrendingDown,
    description: "Forces ASG minimum capacity reduction to trigger CloudWatch alarm metrics and automatic recovery.",
    target: "Auto Scaling Cloud Matrix",
    tags: ["AWS Cloud", "Scaling", "Capacity"],
  },
  "cpu-stress": {
    title: "CPU Stress & Scale-Out",
    category: "Stress Test",
    danger: "Medium",
    duration: "~120s",
    icon: CloudLightning,
    description: "Executes AWS SSM document to spike CPU to 100%, triggering CloudWatch alarms & ASG auto-expansion.",
    target: "SSM / CloudWatch Matrix",
    tags: ["AWS Cloud", "SSM", "CPU-Spike", "ScaleOut"],
  },
  "sg-block": {
    title: "Security Group Isolation",
    category: "Security",
    danger: "High",
    duration: "~40s",
    icon: ShieldAlert,
    description: "Injects ingress block rules to isolate host traffic, testing ALB health check eviction timing.",
    target: "VPC Security Group",
    tags: ["AWS Cloud", "VPC", "SecurityGroup", "Eviction"],
  },
};

export default function TestGrid({
  tests,
  confirmed,
  busyTest,
  health,
  onRunTest,
}) {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = ["All", "Compute", "Networking", "Scaling", "Stress Test", "Security"];

  const handleRunClick = (testName) => {
    soundFX.playExecute();
    onRunTest(testName);
  };

  const filteredTests = tests.filter((testName) => {
    const meta = TEST_METADATA[testName] || {
      title: testName,
      category: "Other",
      description: testName,
    };
    const matchesCategory = activeCategory === "All" || meta.category === activeCategory;
    const matchesSearch =
      meta.title.toLowerCase().includes(search.toLowerCase()) ||
      testName.toLowerCase().includes(search.toLowerCase()) ||
      meta.description.toLowerCase().includes(search.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <section className="test-suite-section">
      <div className="section-header">
        <div>
          <div className="section-eyebrow">
            <CloudLightning className="eyebrow-icon text-cyan cloud-pulse-anim" />
            <span>AWS CLOUD FAULT INJECTION SUITE</span>
          </div>
          <h2 className="section-title">Reliability Validation Scenarios</h2>
        </div>

        <div className="filter-controls">
          <div className="search-input-wrapper">
            <Search className="search-icon" />
            <input
              type="text"
              placeholder="Filter cloud scenarios or resources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
            {search && (
              <button className="clear-search" onClick={() => setSearch("")}>
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="category-tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`tab-btn ${activeCategory === cat ? "active" : ""}`}
            onClick={() => {
              soundFX.playClick();
              setActiveCategory(cat);
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="scenarios-grid">
        {filteredTests.length === 0 ? (
          <div className="empty-search">
            <Info className="empty-icon" />
            <p>No AWS Cloud tests match your search query.</p>
          </div>
        ) : (
          filteredTests.map((testName) => {
            const meta = TEST_METADATA[testName] || {
              title: testName,
              category: "Custom",
              danger: "Medium",
              duration: "~30s",
              icon: Cloud,
              description: "AWS Infrastructure resilience test.",
              target: "AWS Cloud Resource",
              tags: ["AWS", "CloudTest"],
            };

            const IconComponent = meta.icon;
            const isBusy = busyTest === testName;
            const isDisabled = !confirmed || busyTest !== null || health !== "ok";

            return (
              <article
                className={`scenario-card ${isBusy ? "is-running" : ""}`}
                key={testName}
              >
                {/* Holographic HUD corner brackets */}
                <div className="card-hud-corner tl" />
                <div className="card-hud-corner tr" />
                <div className="card-hud-corner bl" />
                <div className="card-hud-corner br" />

                <div className="card-accent-line" />

                <div className="card-header">
                  <div className="icon-badge">
                    <IconComponent className="card-icon cloud-card-icon" />
                  </div>
                  <div className="card-badges">
                    <span className={`danger-pill danger-${meta.danger.toLowerCase()}`}>
                      {meta.danger} Risk
                    </span>
                    <span className="duration-pill">{meta.duration}</span>
                  </div>
                </div>

                <div className="card-body">
                  <div className="test-id">
                    <Cloud className="inline-cloud-tag" />
                    <span>{testName}</span>
                  </div>
                  <h3 className="card-title">{meta.title}</h3>
                  <p className="card-description">{meta.description}</p>
                </div>

                <div className="card-footer">
                  <div className="target-pill">
                    <Radio className="target-icon" />
                    <span>Target: {meta.target}</span>
                  </div>

                  <div className="tags-container">
                    {meta.tags.map((tag) => (
                      <span key={tag} className="tag-chip">
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <button
                    className={`execute-btn ${isBusy ? "busy" : ""}`}
                    disabled={isDisabled}
                    onClick={() => handleRunClick(testName)}
                    title={
                      !confirmed
                        ? "Unlock Guard Shield first to execute cloud tests"
                        : health !== "ok"
                        ? "API is offline"
                        : `Execute ${meta.title}`
                    }
                  >
                    {isBusy ? (
                      <>
                        <span className="btn-spinner" />
                        <span>Injecting Cloud Fault...</span>
                      </>
                    ) : (
                      <>
                        <Play className="play-icon" />
                        <span>Execute Scenario</span>
                      </>
                    )}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
