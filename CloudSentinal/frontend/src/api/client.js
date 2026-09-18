const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.detail || "The backend request failed.");
  }
  return body;
}

export const api = {
  health: () => request("/health"),
  tests: () => request("/tests"),
  testRuns: () => request("/test-runs"),
  testRun: (runId) => request(`/test-runs/${runId}`),
  report: (runId) => request(`/reports/${runId}`),
  runTest: (testName) =>
    request(`/run-test/${testName}`, {
      method: "POST",
      body: JSON.stringify({ confirm: true }),
    }),
};
