import { useState } from "react";
import {
  Cloud,
  CloudLightning,
  CloudCheck,
  Server,
  Globe,
  Shield,
  Activity,
  RefreshCw,
  Zap,
  Radio,
  Cpu,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { soundFX } from "../utils/audio";

export default function ArchTopologyMap({ busyTest, runs = [] }) {
  const [selectedNode, setSelectedNode] = useState(null);

  const activeRun = runs.find((r) => r.status === "running");
  const isInjecting = Boolean(busyTest || activeRun);

  const handleNodeClick = (node) => {
    soundFX.playClick();
    setSelectedNode(node);
  };

  const nodes = [
    {
      id: "alb",
      label: "Cloud Load Balancer",
      sub: "cloudsentinel-alb",
      icon: Cloud,
      type: "network",
      status: busyTest === "detach-lb" ? "warning" : "online",
      metrics: "Port 80/443 • Active Cloud Routing",
      cloudBadge: "ALB INGRESS",
      x: 15,
      y: 45,
    },
    {
      id: "sg",
      label: "VPC Cloud Security",
      sub: "sg-01bc12d8c170b311c",
      icon: Shield,
      type: "security",
      status: busyTest === "sg-block" ? "alert" : "protected",
      metrics: "Ingress Rules • Cloud Perimeter Lock",
      cloudBadge: "VPC FIREWALL",
      x: 40,
      y: 18,
    },
    {
      id: "asg",
      label: "Cloud Auto Scaling Group",
      sub: "cloudsentinel-asg",
      icon: CloudLightning,
      type: "scaling",
      status: busyTest === "scale-asg" || busyTest === "stop-ec2" ? "busy" : "healthy",
      metrics: "Min: 1 • Desired: 2 • Max: 5 Cloud Nodes",
      cloudBadge: "AUTO EXPANSION",
      x: 45,
      y: 75,
    },
    {
      id: "ec2-1",
      label: "EC2 Cloud Compute Node",
      sub: "i-078bd4915333cf75e",
      icon: Server,
      type: "compute",
      status: busyTest === "stop-ec2" || busyTest === "terminate-ec2" ? "degraded" : "healthy",
      metrics: "t3.micro • InService • 100% Health",
      cloudBadge: "AWS INSTANCE",
      x: 75,
      y: 30,
    },
    {
      id: "cw",
      label: "CloudWatch Telemetry Matrix",
      sub: "CloudSentinel-HighCPU",
      icon: Activity,
      type: "telemetry",
      status: busyTest === "cpu-stress" ? "alarm" : "ok",
      metrics: "Threshold > 70% CPU • 300s Cloud Monitoring",
      cloudBadge: "ALARM ENGINE",
      x: 75,
      y: 78,
    },
  ];

  return (
    <div className={`topology-card ${isInjecting ? "topology-injecting" : ""}`}>
      <div className="topology-header">
        <div className="topology-title-group">
          <div className="topo-cloud-icon-bg">
            <CloudLightning className="topology-title-icon cloud-pulse-anim" />
          </div>
          <div>
            <h3 className="topology-title">Live AWS Cloud Topology & Network Map</h3>
            <p className="topology-subtitle">Real-time cloud node status & fault propagation flow</p>
          </div>
        </div>

        <div className="topology-status-pill">
          <Cloud className="pill-cloud-mini" />
          <span className={`topo-dot ${isInjecting ? "pulsing" : ""}`} />
          <span>{isInjecting ? `CLOUD FAULT: ${busyTest || activeRun?.test_name}` : "CLOUD MATRIX STABLE"}</span>
        </div>
      </div>

      <div className="topology-canvas-wrap">
        <svg className="topology-svg-connections" width="100%" height="100%">
          <defs>
            <linearGradient id="cloudLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--cyan-primary)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--purple-accent)" stopOpacity="0.8" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Laser connection lines */}
          <line x1="18%" y1="45%" x2="40%" y2="20%" className={`topo-line ${busyTest === "sg-block" ? "pulse-warning" : ""}`} filter="url(#glow)" />
          <line x1="18%" y1="45%" x2="45%" y2="75%" className={`topo-line ${busyTest === "detach-lb" ? "pulse-warning" : ""}`} filter="url(#glow)" />
          <line x1="45%" y1="75%" x2="75%" y2="30%" className={`topo-line ${busyTest === "stop-ec2" || busyTest === "terminate-ec2" ? "pulse-warning" : ""}`} filter="url(#glow)" />
          <line x1="45%" y1="75%" x2="75%" y2="78%" className={`topo-line ${busyTest === "cpu-stress" ? "pulse-warning" : ""}`} filter="url(#glow)" />
          <line x1="40%" y1="20%" x2="75%" y2="30%" className="topo-line" filter="url(#glow)" />

          {/* Flow data particles along connection paths */}
          <circle cx="18%" cy="45%" r="4" className="cloud-data-dot d1" />
          <circle cx="45%" cy="75%" r="4" className="cloud-data-dot d2" />
          <circle cx="40%" cy="20%" r="4" className="cloud-data-dot d3" />
        </svg>

        <div className="topology-nodes-grid">
          {nodes.map((node) => {
            const Icon = node.icon;
            const isSelected = selectedNode?.id === node.id;
            return (
              <div
                key={node.id}
                className={`topo-node node-${node.status} ${isSelected ? "selected" : ""}`}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
                onClick={() => handleNodeClick(node)}
              >
                <div className="node-hud-corner tl" />
                <div className="node-hud-corner tr" />
                <div className="node-hud-corner bl" />
                <div className="node-hud-corner br" />

                <span className="node-cloud-badge">{node.cloudBadge}</span>

                <div className="node-icon-box">
                  <Icon className="node-icon cloud-node-icon" />
                </div>
                <div className="node-info">
                  <span className="node-label">{node.label}</span>
                  <span className="node-sub">{node.sub}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedNode && (
        <div className="topology-drawer">
          <div className="drawer-header">
            <div className="drawer-title-row">
              <Cloud className="drawer-cloud-icon text-cyan" />
              <h4>Cloud Telemetry Breakdown: {selectedNode.label}</h4>
            </div>
            <button className="drawer-close" onClick={() => { soundFX.playClick(); setSelectedNode(null); }}>
              ×
            </button>
          </div>
          <div className="drawer-body">
            <div>
              <strong>AWS Resource ID:</strong> {selectedNode.sub}
            </div>
            <div>
              <strong>Cloud Node Status:</strong> <span className={`status-tag tag-${selectedNode.status}`}>{selectedNode.status.toUpperCase()}</span>
            </div>
            <div>
              <strong>Live Telemetry:</strong> {selectedNode.metrics}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
