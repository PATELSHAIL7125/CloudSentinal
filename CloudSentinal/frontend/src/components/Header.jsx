import { useState, useEffect } from "react";
import {
  Cloud,
  CloudLightning,
  CloudCheck,
  CloudRain,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Zap,
  Radio,
  Clock,
  Palette,
  Volume2,
  VolumeX,
  Activity,
  Layers,
  Sparkles,
} from "lucide-react";
import { soundFX } from "../utils/audio";

export default function Header({
  health,
  confirmed,
  onToggleConfirm,
  onRefresh,
  isRefreshing,
  theme,
  onSelectTheme,
  showTopology,
  onToggleTopology,
  busyTest,
}) {
  const [time, setTime] = useState("");
  const [soundMuted, setSoundMuted] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false }) + " UTC");
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleSound = () => {
    const newMuted = !soundMuted;
    setSoundMuted(newMuted);
    soundFX.enabled = !newMuted;
    if (!newMuted) soundFX.playClick();
  };

  const handleRefreshClick = () => {
    soundFX.playClick();
    onRefresh();
  };

  const handleConfirmChange = (checked) => {
    if (checked) {
      soundFX.playArmChaos();
    } else {
      soundFX.playDisarmChaos();
    }
    onToggleConfirm(checked);
  };

  const themes = [
    { id: "cyber-neon", name: "Cyber Neon", color: "#00f0ff" },
    { id: "quantum-gold", name: "Quantum Gold", color: "#ffb703" },
    { id: "crimson-alert", name: "Crimson Alert", color: "#ff2a6d" },
    { id: "matrix-emerald", name: "Matrix Emerald", color: "#00ff9d" },
  ];

  return (
    <header className="header-hub">
      {/* Ticker Marquee Bar with Cloud Indicators */}
      <div className="telemetry-ticker">
        <div className="ticker-badge">
          <CloudLightning className="ticker-icon" />
          <span>CLOUD SENTINEL TICKER</span>
        </div>
        <div className="ticker-marquee-wrapper">
          <div className="ticker-track">
            <span className="ticker-item">
              <Cloud className="inline-icon" /> AWS CLOUD REGION: <strong>ap-south-1</strong>
            </span>
            <span className="ticker-sep">•</span>
            <span className="ticker-item">
              AUTO SCALING CLOUD MATRIX: <strong>cloudsentinel-asg</strong>
            </span>
            <span className="ticker-sep">•</span>
            <span className="ticker-item">
              ALB CLOUD INGRESS: <strong>cloudsentinel-alb-1832071800.ap-south-1.elb.amazonaws.com</strong>
            </span>
            <span className="ticker-sep">•</span>
            <span className="ticker-item">
              CLOUD GUARD: <strong>{confirmed ? "ARMED (LIVE CHAOS)" : "PROTECTED (SAFE CLOUD)"}</strong>
            </span>
            <span className="ticker-sep">•</span>

            {/* Duplicate sequence for seamless marquee loop */}
            <span className="ticker-item">
              <Cloud className="inline-icon" /> AWS CLOUD REGION: <strong>ap-south-1</strong>
            </span>
            <span className="ticker-sep">•</span>
            <span className="ticker-item">
              AUTO SCALING CLOUD MATRIX: <strong>cloudsentinel-asg</strong>
            </span>
            <span className="ticker-sep">•</span>
            <span className="ticker-item">
              ALB CLOUD INGRESS: <strong>cloudsentinel-alb-1832071800.ap-south-1.elb.amazonaws.com</strong>
            </span>
            <span className="ticker-sep">•</span>
            <span className="ticker-item">
              CLOUD GUARD: <strong>{confirmed ? "ARMED (LIVE CHAOS)" : "PROTECTED (SAFE CLOUD)"}</strong>
            </span>
          </div>
        </div>
      </div>

      <div className="header-top">
        {/* Brand Group with Modern High-Tech Cloud Sentinel Emblem */}
        <div className="brand-group">
          <div className={`logo-badge ${busyTest ? "active-injection" : ""}`}>
            <div className="logo-glow-orb" />
            <div className="logo-icon-wrapper">
              {busyTest ? (
                <CloudLightning className="logo-icon active-glow spin-pulse" />
              ) : confirmed ? (
                <CloudRain className="logo-icon armed-glow" />
              ) : (
                <CloudCheck className="logo-icon safe-glow" />
              )}
            </div>
          </div>
          <div>
            <div className="brand-title-row">
              <h1 className="brand-title">
                Cloud<span className="brand-title-highlight">Sentinel</span>
              </h1>
              <span className="version-pill">v2.4 PRO</span>
            </div>
            <p className="brand-subtitle">
              Autonomous AWS Cloud Resilience & Chaos Engineering Platform
            </p>
          </div>
        </div>



        <div className="header-controls">
          {/* Cloud Matrix Weather Status Pill */}
          <div
            className={`cloud-status-pill ${
              busyTest ? "cloud-state-injecting" : confirmed ? "cloud-state-armed" : "cloud-state-safe"
            }`}
          >
            {busyTest ? (
              <CloudLightning className="pill-cloud-icon pulse-alert" />
            ) : confirmed ? (
              <CloudRain className="pill-cloud-icon" />
            ) : (
              <CloudCheck className="pill-cloud-icon" />
            )}
            <div className="pill-cloud-text">
              <span className="pill-label">CLOUD MATRIX</span>
              <span className="pill-val">
                {busyTest ? "CHAOS INJECTION" : confirmed ? "STORM ARMED" : "CLEAR & STABLE"}
              </span>
            </div>
          </div>

          {/* Live Audio Equalizer Visualizer */}
          <div className="visualizer-bar" title="Live Telemetry Frequency Signal">
            <span className="bar b1" />
            <span className="bar b2" />
            <span className="bar b3" />
            <span className="bar b4" />
            <span className="bar b5" />
          </div>

          <div className="live-clock">
            <Clock className="clock-icon" />
            <span>{time}</span>
          </div>

          {/* Sound Mute Toggle */}
          <button
            className={`sound-toggle-btn ${soundMuted ? "muted" : ""}`}
            onClick={toggleSound}
            title={soundMuted ? "Unmute Cyber Sound Effects" : "Mute Cyber Sound Effects"}
          >
            {soundMuted ? <VolumeX className="btn-icon text-crimson" /> : <Volume2 className="btn-icon text-cyan" />}
          </button>

          {/* Theme Selector Hub */}
          <div className="theme-selector-hub">
            <Palette className="theme-icon" />
            <select
              className="theme-select"
              value={theme}
              onChange={(e) => {
                soundFX.playClick();
                onSelectTheme(e.target.value);
              }}
              title="Switch Visual Cloud Theme"
            >
              {themes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Topology Map Toggle */}
          <button
            className={`topo-toggle-btn ${showTopology ? "active" : ""}`}
            onClick={() => {
              soundFX.playClick();
              onToggleTopology();
            }}
            title="Toggle Visual AWS Cloud Topology Map"
          >
            <Layers className="btn-icon" />
            <span>Cloud Topology</span>
          </button>

          <div className={`status-badge status-badge-${health}`}>
            <span className="status-dot" />
            <Radio className="status-icon" />
            <span className="status-text">API: {health.toUpperCase()}</span>
          </div>

          <button
            className={`refresh-btn ${isRefreshing ? "spin" : ""}`}
            onClick={handleRefreshClick}
            title="Refresh Cloud Sentinel Telemetry"
          >
            <RefreshCw className="btn-icon" />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Safety Guard Banner */}
      <div className={`safety-banner ${confirmed ? "safety-active" : "safety-warning"}`}>
        <div className="safety-left">
          <div className="safety-icon-wrapper">
            {confirmed ? (
              <CloudLightning className="safety-icon text-amber pulse-alert" />
            ) : (
              <ShieldCheck className="safety-icon text-emerald" />
            )}
          </div>
          <div>
            <h4 className="safety-heading">
              {confirmed
                ? "AWS CLOUD CHAOS INJECTION AUTHORIZED"
                : "AWS CLOUD INFRASTRUCTURE GUARD ACTIVE"}
            </h4>
            <p className="safety-desc">
              {confirmed
                ? "AWS infrastructure modifications enabled. Controlled cloud fault scenarios can be triggered."
                : "Acknowledge AWS infrastructure risks to unlock and run chaos experiment suites."}
            </p>
          </div>
        </div>

        <label className="toggle-switch-container" htmlFor="safety-toggle">
          <input
            id="safety-toggle"
            type="checkbox"
            checked={confirmed}
            onChange={(e) => handleConfirmChange(e.target.checked)}
          />
          <span className="toggle-slider">
            <span className="toggle-knob">
              {confirmed ? <Zap className="knob-icon" /> : <ShieldAlert className="knob-icon" />}
            </span>
          </span>
          <span className="toggle-label">
            {confirmed ? "GUARD UNLOCKED" : "ARM CHAOS TEST"}
          </span>
        </label>
      </div>
    </header>
  );
}
