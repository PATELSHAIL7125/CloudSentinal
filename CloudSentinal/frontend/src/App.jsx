import { useEffect, useState } from "react";
import { api } from "./api/client";
import CyberBackground from "./components/CyberBackground";
import Header from "./components/Header";
import MetricCards from "./components/MetricCards";
import TestGrid from "./components/TestGrid";
import TerminalReportSection from "./components/TerminalReportSection";
import ArchTopologyMap from "./components/ArchTopologyMap";
import { AlertCircle, X } from "lucide-react";
import { soundFX } from "./utils/audio";

export default function App() {
  const [health, setHealth] = useState("checking");
  const [tests, setTests] = useState([]);
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [report, setReport] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busyTest, setBusyTest] = useState(null);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [theme, setTheme] = useState("cyber-neon");
  const [showTopology, setShowTopology] = useState(true);

  async function loadDashboard() {
    setIsRefreshing(true);
    try {
      const [healthData, testsData, runsData] = await Promise.all([
        api.health(),
        api.tests(),
        api.testRuns(),
      ]);
      setHealth(healthData.status || "ok");
      setTests(testsData.tests || []);
      const fetchedRuns = runsData || [];
      setRuns(fetchedRuns);
      setError("");

      if (!selectedRun && fetchedRuns.length > 0) {
        openRun(fetchedRuns[0]);
      }
    } catch (requestError) {
      setHealth("offline");
      setError(requestError.message);
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  }

  useEffect(() => {
    loadDashboard();
    const intervalId = window.setInterval(loadDashboard, 5000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!selectedRun || selectedRun.status === "passed" || selectedRun.status === "failed") return;
    const intervalId = window.setInterval(async () => {
      try {
        const run = await api.testRun(selectedRun.id);
        setSelectedRun(run);
        if (run.status === "passed" || run.status === "failed") {
          if (run.status === "passed") soundFX.playSuccess();
          setReport(await api.report(run.id));
          setBusyTest(null);
          loadDashboard();
        }
      } catch (requestError) {
        setError(requestError.message);
      }
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, [selectedRun?.id, selectedRun?.status]);

  async function startTest(testName) {
    if (!confirmed) {
      setError("Confirm that you understand this test changes AWS infrastructure first.");
      return;
    }
    try {
      setError("");
      setBusyTest(testName);
      const started = await api.runTest(testName);
      const run = await api.testRun(started.run_id);
      setSelectedRun(run);
      setReport(null);
      await loadDashboard();
    } catch (requestError) {
      setBusyTest(null);
      setError(requestError.message);
    }
  }

  async function openRun(run) {
    setSelectedRun(run);
    setReport(null);
    try {
      const currentRun = await api.testRun(run.id);
      setSelectedRun(currentRun);
      if (currentRun.status === "passed" || currentRun.status === "failed") {
        setReport(await api.report(run.id));
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className={`cyber-root theme-${theme}`}>
      {/* Interactive Canvas Background with Floating Cyber Clouds */}
      <CyberBackground theme={theme} isInjecting={Boolean(busyTest)} />

      <main className="app-shell">
        <Header
          health={health}
          confirmed={confirmed}
          onToggleConfirm={setConfirmed}
          onRefresh={loadDashboard}
          isRefreshing={isRefreshing}
          theme={theme}
          onSelectTheme={setTheme}
          showTopology={showTopology}
          onToggleTopology={() => setShowTopology(!showTopology)}
          busyTest={busyTest}
        />

        {error && (
          <div className="error-toast">
            <AlertCircle className="toast-icon" />
            <div className="toast-body">{error}</div>
            <button className="toast-close" onClick={() => setError("")}>
              <X className="close-icon" />
            </button>
          </div>
        )}

        <MetricCards
          tests={tests}
          runs={runs}
          confirmed={confirmed}
          health={health}
        />

        {showTopology && (
          <ArchTopologyMap busyTest={busyTest} runs={runs} />
        )}

        <TestGrid
          tests={tests}
          confirmed={confirmed}
          busyTest={busyTest}
          health={health}
          onRunTest={startTest}
        />

        <TerminalReportSection
          runs={runs}
          selectedRun={selectedRun}
          report={report}
          onSelectRun={openRun}
        />
      </main>
    </div>
  );
}
