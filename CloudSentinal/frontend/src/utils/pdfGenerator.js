import { jsPDF } from "jspdf";
import { TEST_METADATA } from "../components/TestGrid";

/**
 * Generates an executive-grade PDF Report for a single CloudSentinel test run result.
 * @param {Object} params
 * @param {Object} params.selectedRun - The selected test run object
 * @param {Object} params.report - The report object containing summary, output, recommendation
 */
export function generateRunPdfReport({ selectedRun, report }) {
  if (!selectedRun) return;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  const testKey = selectedRun.test_name;
  const testInfo = TEST_METADATA[testKey] || {};
  const testTitle = testInfo.title || testKey;
  const status = (selectedRun.status || "UNKNOWN").toUpperCase();
  const runId = selectedRun.id || "N/A";
  const runDate = new Date(selectedRun.created_at || Date.now()).toLocaleString("en-US", {
    dateStyle: "full",
    timeStyle: "medium",
  });

  const isPassed = status === "PASSED";
  const isFailed = status === "FAILED";

  // Colors
  const darkBg = [11, 19, 41];
  const cyanPrimary = [0, 242, 254];
  const textDark = [15, 23, 42];
  const textMuted = [100, 116, 139];
  const cardBg = [248, 250, 252];
  const cardBorder = [226, 232, 240];

  const statusGreen = [16, 185, 129];
  const statusRed = [239, 68, 68];
  const statusAmber = [245, 158, 11];

  let currentY = 0;

  function drawHeaderBanner() {
    doc.setFillColor(...darkBg);
    doc.rect(0, 0, pageWidth, 36, "F");

    doc.setFillColor(...cyanPrimary);
    doc.rect(0, 0, pageWidth, 3, "F");

    doc.setTextColor(...cyanPrimary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("CLOUDSENTINEL", margin, 16);

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("AWS CLOUD INFRASTRUCTURE RELIABILITY & RESILIENCE AUDIT REPORT", margin, 23);

    doc.setFillColor(20, 35, 65);
    doc.roundedRect(pageWidth - margin - 52, 10, 52, 16, 2, 2, "F");
    doc.setTextColor(...cyanPrimary);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("AWS AUDIT VERIFIED", pageWidth - margin - 48, 17);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 220, 255);
    doc.text("Security & Fault Test", pageWidth - margin - 48, 22);

    currentY = 44;
  }

  function drawPageFooter(pageNumber, totalPages) {
    doc.setFillColor(...cardBorder);
    doc.rect(margin, pageHeight - 14, contentWidth, 0.4, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(
      `CloudSentinel Reliability Matrix | Generated: ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`,
      margin,
      pageHeight - 8
    );
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, pageHeight - 8, {
      align: "right",
    });
  }

  drawHeaderBanner();

  // Metadata Card
  doc.setFillColor(...cardBg);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(margin, currentY, contentWidth, 34, 3, 3, "FD");

  doc.setFontSize(9);
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("TEST SCENARIO:", margin + 5, currentY + 9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  doc.text(testTitle, margin + 35, currentY + 9);

  const statusColor = isPassed ? statusGreen : isFailed ? statusRed : statusAmber;
  doc.setFillColor(...statusColor);
  doc.roundedRect(pageWidth - margin - 35, currentY + 5, 30, 8, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(status, pageWidth - margin - 20, currentY + 10.5, { align: "center" });

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("RUN IDENTIFIER:", margin + 5, currentY + 17);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(String(runId), margin + 35, currentY + 17);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("TEST CODE:", margin + 95, currentY + 17);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(testKey, margin + 120, currentY + 17);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("EXECUTION TIME:", margin + 5, currentY + 25);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(runDate, margin + 35, currentY + 25);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textDark);
  doc.text("TARGET ENV:", margin + 95, currentY + 25);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(71, 85, 105);
  doc.text(testInfo.target || "AWS Cloud Compute", margin + 120, currentY + 25);

  currentY += 42;

  // Section 1: Scenario Objective
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...darkBg);
  doc.text("1. CHAOS EXPERIMENT OBJECTIVE & DESCRIPTION", margin, currentY);
  currentY += 3;

  doc.setFillColor(...cyanPrimary);
  doc.rect(margin, currentY, 35, 0.8, "F");
  currentY += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  const descText = testInfo.description || "Controlled resilience test injected to validate AWS target recovery behavior.";
  const splitDesc = doc.splitTextToSize(descText, contentWidth);
  doc.text(splitDesc, margin, currentY);
  currentY += splitDesc.length * 5 + 6;

  // Section 2: Findings
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...darkBg);
  doc.text("2. AWS TELEMETRY FINDINGS & EXECUTION SUMMARY", margin, currentY);
  currentY += 3;

  doc.setFillColor(...cyanPrimary);
  doc.rect(margin, currentY, 35, 0.8, "F");
  currentY += 6;

  const summaryText = report?.summary || selectedRun?.summary || "No automated summary generated for this run.";
  const splitSummary = doc.splitTextToSize(summaryText, contentWidth - 10);
  const summaryBoxHeight = Math.max(16, splitSummary.length * 5 + 8);

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, contentWidth, summaryBoxHeight, 2, 2, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text(splitSummary, margin + 5, currentY + 7);

  currentY += summaryBoxHeight + 10;

  // Section 3: Recommendation
  if (report?.recommendation) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(16, 185, 129);
    doc.text("3. SENTINEL CLOUD RECOMMENDATION & MITIGATION", margin, currentY);
    currentY += 3;

    doc.setFillColor(16, 185, 129);
    doc.rect(margin, currentY, 35, 0.8, "F");
    currentY += 6;

    const splitRec = doc.splitTextToSize(report.recommendation, contentWidth - 10);
    const recBoxHeight = Math.max(16, splitRec.length * 5 + 8);

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(margin, currentY, contentWidth, recBoxHeight, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(6, 78, 59);
    doc.text(splitRec, margin + 5, currentY + 7);

    currentY += recBoxHeight + 10;
  }

  // Section 4: Telemetry Logs
  if (currentY > pageHeight - 60) {
    doc.addPage();
    drawHeaderBanner();
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...darkBg);
  doc.text("4. DETAILED AWS STDOUT COMMAND LOGS", margin, currentY);
  currentY += 3;

  doc.setFillColor(...cyanPrimary);
  doc.rect(margin, currentY, 35, 0.8, "F");
  currentY += 7;

  const rawLogs = report?.output || selectedRun?.output || "No console log output available.";
  const rawLogLines = rawLogs.split("\n");

  doc.setFont("Courier", "normal");
  doc.setFontSize(7.5);

  const maxLogY = pageHeight - 20;

  const startTerminalBlock = () => {
    doc.setFillColor(5, 9, 20);
    doc.rect(margin, currentY, contentWidth, pageHeight - currentY - 18, "F");
    currentY += 5;
  };

  startTerminalBlock();

  rawLogLines.forEach((line) => {
    const wrappedLines = doc.splitTextToSize(line, contentWidth - 8);

    wrappedLines.forEach((wLine) => {
      if (currentY > maxLogY) {
        doc.addPage();
        drawHeaderBanner();
        currentY = 44;
        doc.setFont("Courier", "normal");
        doc.setFontSize(7.5);
        startTerminalBlock();
      }

      if (wLine.includes("ERROR") || wLine.includes("FAIL") || wLine.includes("Failed")) {
        doc.setTextColor(248, 113, 113);
      } else if (wLine.includes("PASSED") || wLine.includes("SUCCESS") || wLine.includes("Pass")) {
        doc.setTextColor(52, 211, 153);
      } else if (wLine.includes("WARN") || wLine.includes("Warning")) {
        doc.setTextColor(251, 191, 36);
      } else {
        doc.setTextColor(148, 163, 184);
      }

      doc.text(wLine, margin + 4, currentY);
      currentY += 4.2;
    });
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(i, totalPages);
  }

  const cleanTestName = testKey.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `CloudSentinel_Report_${cleanTestName}_Run_${runId}.pdf`;
  doc.save(fileName);
}

/**
 * Generates a master PDF report compiling results across ALL test cases/runs in the ledger.
 * @param {Object} params
 * @param {Array} params.runs - Array of all test runs
 */
export function generateAllRunsPdfReport({ runs }) {
  if (!runs || runs.length === 0) return;

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;

  // Stats calculation
  const totalRuns = runs.length;
  const passedRuns = runs.filter((r) => r.status === "passed").length;
  const failedRuns = runs.filter((r) => r.status === "failed").length;
  const passRate = totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

  // Colors
  const darkBg = [11, 19, 41];
  const cyanPrimary = [0, 242, 254];
  const textDark = [15, 23, 42];
  const textMuted = [100, 116, 139];
  const cardBg = [248, 250, 252];
  const cardBorder = [226, 232, 240];

  const statusGreen = [16, 185, 129];
  const statusRed = [239, 68, 68];
  const statusAmber = [245, 158, 11];

  let currentY = 0;

  function drawHeaderBanner() {
    doc.setFillColor(...darkBg);
    doc.rect(0, 0, pageWidth, 36, "F");

    doc.setFillColor(...cyanPrimary);
    doc.rect(0, 0, pageWidth, 3, "F");

    doc.setTextColor(...cyanPrimary);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("CLOUDSENTINEL", margin, 16);

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("MASTER AWS RELIABILITY & FULL FAULT EXPERIMENT SUITE REPORT", margin, 23);

    doc.setFillColor(20, 35, 65);
    doc.roundedRect(pageWidth - margin - 58, 10, 58, 16, 2, 2, "F");
    doc.setTextColor(...cyanPrimary);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("COMPREHENSIVE AUDIT", pageWidth - margin - 54, 17);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 220, 255);
    doc.text("Full Ledger Summary", pageWidth - margin - 54, 22);

    currentY = 44;
  }

  function drawPageFooter(pageNumber, totalPages) {
    doc.setFillColor(...cardBorder);
    doc.rect(margin, pageHeight - 14, contentWidth, 0.4, "F");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(
      `CloudSentinel Full Audit Ledger | Generated: ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`,
      margin,
      pageHeight - 8
    );
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, pageHeight - 8, {
      align: "right",
    });
  }

  drawHeaderBanner();

  // --- Executive Stats Card ---
  doc.setFillColor(...cardBg);
  doc.setDrawColor(...cardBorder);
  doc.roundedRect(margin, currentY, contentWidth, 26, 3, 3, "FD");

  const colWidth = contentWidth / 4;

  // Metric 1: Total Runs
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...textMuted);
  doc.text("TOTAL RUNS", margin + 6, currentY + 8);
  doc.setFontSize(14);
  doc.setTextColor(...textDark);
  doc.text(String(totalRuns), margin + 6, currentY + 18);

  // Metric 2: Passed
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text("PASSED RUNS", margin + colWidth + 6, currentY + 8);
  doc.setFontSize(14);
  doc.setTextColor(...statusGreen);
  doc.text(String(passedRuns), margin + colWidth + 6, currentY + 18);

  // Metric 3: Failed
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text("FAILED RUNS", margin + colWidth * 2 + 6, currentY + 8);
  doc.setFontSize(14);
  doc.setTextColor(...statusRed);
  doc.text(String(failedRuns), margin + colWidth * 2 + 6, currentY + 18);

  // Metric 4: Pass Rate
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text("SUITE PASS RATE", margin + colWidth * 3 + 6, currentY + 8);
  doc.setFontSize(14);
  doc.setTextColor(...cyanPrimary);
  doc.text(`${passRate}%`, margin + colWidth * 3 + 6, currentY + 18);

  currentY += 34;

  // --- Section 1: Execution Ledger Table ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...darkBg);
  doc.text("1. ALL TEST CASE EXECUTION LEDGER SUMMARY", margin, currentY);
  currentY += 3;

  doc.setFillColor(...cyanPrimary);
  doc.rect(margin, currentY, 35, 0.8, "F");
  currentY += 6;

  // Table Header
  doc.setFillColor(...darkBg);
  doc.rect(margin, currentY, contentWidth, 8, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);

  doc.text("#", margin + 4, currentY + 5.5);
  doc.text("RUN ID", margin + 14, currentY + 5.5);
  doc.text("TEST SCENARIO", margin + 48, currentY + 5.5);
  doc.text("EXECUTION TIME", margin + 115, currentY + 5.5);
  doc.text("STATUS", margin + 160, currentY + 5.5);

  currentY += 8;

  // Table Content
  runs.forEach((run, index) => {
    if (currentY > pageHeight - 25) {
      doc.addPage();
      drawHeaderBanner();
    }

    const isEven = index % 2 === 0;
    doc.setFillColor(isEven ? 255 : 248, isEven ? 255 : 250, isEven ? 255 : 252);
    doc.rect(margin, currentY, contentWidth, 7.5, "F");

    const testInfo = TEST_METADATA[run.test_name] || {};
    const title = testInfo.title || run.test_name;
    const dateStr = new Date(run.created_at || Date.now()).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const runStatus = (run.status || "UNKNOWN").toUpperCase();

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...textDark);

    doc.text(String(index + 1), margin + 4, currentY + 5);
    doc.text(`#${String(run.id).slice(-8)}`, margin + 14, currentY + 5);

    const truncTitle = title.length > 32 ? title.slice(0, 30) + "…" : title;
    doc.text(truncTitle, margin + 48, currentY + 5);
    doc.text(dateStr, margin + 115, currentY + 5);

    const sColor = runStatus === "PASSED" ? statusGreen : runStatus === "FAILED" ? statusRed : statusAmber;
    doc.setFillColor(...sColor);
    doc.roundedRect(margin + 156, currentY + 1.5, 22, 4.8, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(runStatus, margin + 167, currentY + 5, { align: "center" });

    currentY += 7.5;
  });

  currentY += 12;

  // --- Section 2: Individual Test Case Result Breakdown ---
  if (currentY > pageHeight - 40) {
    doc.addPage();
    drawHeaderBanner();
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...darkBg);
  doc.text("2. INDIVIDUAL SCENARIO FINDINGS & BREAKDOWN", margin, currentY);
  currentY += 3;

  doc.setFillColor(...cyanPrimary);
  doc.rect(margin, currentY, 35, 0.8, "F");
  currentY += 8;

  runs.forEach((run) => {
    if (currentY > pageHeight - 45) {
      doc.addPage();
      drawHeaderBanner();
    }

    const testInfo = TEST_METADATA[run.test_name] || {};
    const title = testInfo.title || run.test_name;
    const runStatus = (run.status || "UNKNOWN").toUpperCase();
    const isPass = runStatus === "PASSED";
    const sColor = isPass ? statusGreen : runStatus === "FAILED" ? statusRed : statusAmber;

    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, contentWidth, 8, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...textDark);
    doc.text(`[Run #${run.id}] ${title}`, margin + 4, currentY + 5.5);

    doc.setFillColor(...sColor);
    doc.roundedRect(pageWidth - margin - 24, currentY + 1.5, 20, 5, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.text(runStatus, pageWidth - margin - 14, currentY + 5, { align: "center" });

    currentY += 11;

    const summaryText = run.summary || "Test execution completed. Detailed telemetry recorded in live ledger.";
    const splitText = doc.splitTextToSize(summaryText, contentWidth - 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(splitText, margin + 4, currentY);

    currentY += splitText.length * 4.5 + 8;
  });

  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawPageFooter(i, totalPages);
  }

  const fileName = `CloudSentinel_Master_Audit_Report_All_Runs.pdf`;
  doc.save(fileName);
}
