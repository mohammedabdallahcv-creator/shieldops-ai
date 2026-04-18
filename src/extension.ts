import * as vscode from "vscode";

type ShieldOpsTask =
  | "analyze"
  | "autofix"
  | "sbom"
  | "compose"
  | "k8s"
  | "cost"
  | "compose_generator";

type ExtensionApiResponse = {
  task?: ShieldOpsTask;
  mode?: "api" | "web_fallback";
  title?: string;
  route?: string;
  reason?: string;
  summary?: string;
  result?: unknown;
  error?: string;
  details?: string;
};

const TASK_ROUTE_MAP: Record<ShieldOpsTask, string> = {
  analyze: "/",
  autofix: "/autofix",
  sbom: "/sbom",
  compose: "/compose-scan",
  k8s: "/k8s",
  cost: "/cloud-cost",
  compose_generator: "/compose",
};

const TASK_LABELS: Record<ShieldOpsTask, string> = {
  analyze: "Dockerfile Analysis",
  autofix: "AutoFix",
  sbom: "SBOM",
  compose: "Compose Scan",
  k8s: "Kubernetes Scan",
  cost: "Cloud Cost",
  compose_generator: "Compose Generator",
};

const TASK_ALLOWED_EXTENSIONS: Record<ShieldOpsTask, string[]> = {
  analyze: [".dockerfile", ""],
  autofix: [".dockerfile", ""],
  sbom: [".dockerfile", "", ".txt", ".json", ".xml", ".mod"],
  compose: [".yml", ".yaml"],
  k8s: [".yml", ".yaml"],
  cost: [".dockerfile", ""],
  compose_generator: [".dockerfile", ""],
};

export function activate(context: vscode.ExtensionContext) {
  const registrations = [
    vscode.window.registerWebviewViewProvider(
      "shieldops-ai.sidebarView",
      new ShieldOpsSidebarViewProvider(context),
    ),
    registerTaskCommand("shieldops-ai.openHub", context, undefined),
    registerTaskCommand("shieldops-ai.analyzeCurrentFile", context, "analyze"),
    registerTaskCommand("shieldops-ai.autofixCurrentDockerfile", context, "autofix"),
    registerTaskCommand("shieldops-ai.generateSbomFromCurrentFile", context, "sbom"),
    registerTaskCommand("shieldops-ai.scanComposeCurrentFile", context, "compose"),
    registerTaskCommand("shieldops-ai.scanK8sCurrentFile", context, "k8s"),
    registerTaskCommand("shieldops-ai.estimateCloudCostFromCurrentFile", context, "cost"),
    registerTaskCommand("shieldops-ai.generateComposeFromCurrentFile", context, "compose_generator"),
  ];

  context.subscriptions.push(...registrations);
}

class ShieldOpsSidebarViewProvider implements vscode.WebviewViewProvider {
  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    webviewView.webview.options = {
      enableScripts: true,
    };

    webviewView.webview.html = getSidebarHtml();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      const command = String(message?.command || "").trim();
      if (!command) {
        return;
      }

      if (command === "shieldops-ai.openHub") {
        await vscode.commands.executeCommand(command);
        return;
      }

      const activeEditor = vscode.window.activeTextEditor;
      const resource = activeEditor?.document?.uri;
      await vscode.commands.executeCommand(command, resource);
    });
  }
}

function registerTaskCommand(
  commandId: string,
  context: vscode.ExtensionContext,
  task?: ShieldOpsTask,
) {
  return vscode.commands.registerCommand(commandId, async (uri?: vscode.Uri) => {
    if (!task) {
      await openExternal(buildBaseUrl(), "/integrations-hub");
      return;
    }

    const document = await resolveDocument(uri);
    if (!document) {
      return;
    }

    const validationError = validateDocumentForTask(document, task);
    if (validationError) {
      vscode.window.showWarningMessage(validationError);
      return;
    }

    const content = document.getText();
    if (!content.trim()) {
      vscode.window.showWarningMessage("ShieldOps AI: the current file is empty.");
      return;
    }

    const fileName = vscode.workspace.asRelativePath(document.uri, false) || document.fileName;
    const baseUrl = buildBaseUrl();

    try {
      const payload = await runRemoteTask(baseUrl, task, content, fileName);

      if (payload.mode === "web_fallback") {
        await vscode.env.clipboard.writeText(content);
        const route = payload.route || TASK_ROUTE_MAP[task];
        await openExternal(baseUrl, route);
        vscode.window.showInformationMessage(
          payload.summary || `ShieldOps AI opened the web flow for ${TASK_LABELS[task]}.`,
        );
        return;
      }

      await showResultPanel(context, task, fileName, payload);

      const choice = await vscode.window.showInformationMessage(
        payload.summary || `ShieldOps AI completed ${TASK_LABELS[task]}.`,
        "Open in Web App",
      );

      if (choice === "Open in Web App") {
        const scanId = (payload.result as any)?.scan_id;
        let targetRoute = payload.route || TASK_ROUTE_MAP[task];
        if (scanId) {
          targetRoute = `/analyze/report_view?scan_id=${scanId}`;
        }
        await openExternal(baseUrl, targetRoute);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      vscode.window.showErrorMessage(`ShieldOps AI: ${message}`);
    }
  });
}

async function runRemoteTask(
  baseUrl: string,
  task: ShieldOpsTask,
  content: string,
  fileName: string,
): Promise<ExtensionApiResponse> {
  const apiUrl = `${baseUrl}/api/ext/run`;
  const token = buildApiToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["X-ShieldOps-Extension-Key"] = token;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      task,
      content,
      filename: fileName,
      options: task === "compose_generator" ? { services: [] } : {},
    }),
  });

  const payload = (await safeJson(response)) as ExtensionApiResponse;
  if (!response.ok) {
    throw new Error(payload.details || payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

async function resolveDocument(uri?: vscode.Uri): Promise<vscode.TextDocument | undefined> {
  if (uri) {
    return vscode.workspace.openTextDocument(uri);
  }

  const activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    return activeEditor.document;
  }

  vscode.window.showWarningMessage("ShieldOps AI: open a file first.");
  return undefined;
}

function validateDocumentForTask(document: vscode.TextDocument, task: ShieldOpsTask): string | undefined {
  const extension = getExtension(document);
  const fileName = document.fileName.toLowerCase();
  const basename = fileName.split(/[\\/]/).pop() || fileName;

  if ((task === "analyze" || task === "autofix" || task === "cost" || task === "compose_generator") && !isDockerfileLike(basename, extension)) {
    return `ShieldOps AI: ${TASK_LABELS[task]} currently expects a Dockerfile or *.dockerfile file.`;
  }

  if (task === "compose" && !isComposeLike(basename)) {
    return "ShieldOps AI: Compose Scan expects docker-compose.yml, docker-compose.yaml, compose.yml, or compose.yaml.";
  }

  if (task === "k8s" && ![".yml", ".yaml"].includes(extension)) {
    return "ShieldOps AI: Kubernetes Scan expects a .yml or .yaml manifest.";
  }

  if (task === "sbom") {
    const allowedBasenames = new Set([
      "dockerfile",
      "requirements.txt",
      "package.json",
      "pom.xml",
      "composer.json",
      "go.mod",
      "gemfile",
    ]);
    if (!allowedBasenames.has(basename) && !isDockerfileLike(basename, extension)) {
      return "ShieldOps AI: SBOM currently supports Dockerfile, requirements.txt, package.json, pom.xml, composer.json, go.mod, or Gemfile.";
    }
  }

  const allowedExtensions = TASK_ALLOWED_EXTENSIONS[task];
  if (!allowedExtensions.includes(extension) && !isDockerfileLike(basename, extension)) {
    return `ShieldOps AI: ${TASK_LABELS[task]} does not support this file type yet.`;
  }

  return undefined;
}

function buildBaseUrl(): string {
  const config = vscode.workspace.getConfiguration("shieldopsAI");
  const configured = String(config.get("baseUrl") || "https://shieldops-ai.onrender.com").trim();
  const normalized = configured.replace(/\/+$/, "");
  if (!normalized) {
    return "https://shieldops-ai.onrender.com";
  }
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(normalized)) {
    return "https://shieldops-ai.onrender.com";
  }
  return normalized;
}

function buildApiToken(): string {
  const config = vscode.workspace.getConfiguration("shieldopsAI");
  return String(config.get("apiToken") || "").trim();
}

async function openExternal(baseUrl: string, target: string | vscode.Uri) {
  const uri = typeof target === "string" ? vscode.Uri.parse(`${baseUrl}${target}`) : target;
  await vscode.env.openExternal(uri);
}

async function showResultPanel(
  context: vscode.ExtensionContext,
  task: ShieldOpsTask,
  fileName: string,
  payload: ExtensionApiResponse,
) {
  const panel = vscode.window.createWebviewPanel(
    "shieldopsResult",
    `ShieldOps AI: ${TASK_LABELS[task]}`,
    vscode.ViewColumn.Beside,
    { enableFindWidget: true },
  );

  const summary = escapeHtml(payload.summary || `${TASK_LABELS[task]} completed.`);
  const title = escapeHtml(payload.title || TASK_LABELS[task]);
  const route = escapeHtml(payload.route || TASK_ROUTE_MAP[task]);
  const result = payload.result;
  const findings = extractFindings(result);
  const stats = extractStats(result, findings.length);
  const statCards = stats.map((item) => `
    <div class="meta-card">
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.value)}</span>
    </div>
  `).join("");
  const taskBody = renderTaskBody(task, result, findings);

  panel.webview.html = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
      <style>
        body {
          margin: 0;
          font-family: "JetBrains Mono", Consolas, monospace;
          background: #0a0a0f;
          color: #e8eaf0;
          padding: 24px;
          line-height: 1.65;
        }
        .card {
          max-width: 940px;
          margin: 0 auto;
          border-radius: 18px;
          padding: 22px 24px;
          background: #0f1117;
          border: 1px solid #1e1e2e;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.32);
        }
        .eyebrow {
          display: inline-block;
          margin-bottom: 10px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(124, 58, 237, 0.15);
          color: #a78bfa;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        h1 {
          margin: 0 0 8px;
          font-size: 1.45rem;
          color: #f5f3ff;
        }
        p {
          color: #606880;
        }
        .sub {
          margin: 0 0 20px;
          font-size: 11px;
        }
        .meta {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
          margin: 18px 0;
        }
        .meta-card {
          border-radius: 14px;
          border: 1px solid #1e1e2e;
          padding: 12px 14px;
          background: #12121a;
        }
        .meta-card strong {
          display: block;
          margin-bottom: 6px;
          color: #f5f3ff;
        }
        .badge {
          display: inline-block;
          padding: 2px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          background: rgba(124, 58, 237, 0.15);
          color: #a78bfa;
          border: 1px solid rgba(124, 58, 237, 0.3);
          margin-bottom: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }
        th {
          text-align: left;
          color: #606880;
          font-size: 11px;
          padding: 6px 10px;
          border-bottom: 1px solid #1e1e2e;
        }
        td {
          padding: 8px 10px;
          border-bottom: 1px solid #12121a;
          vertical-align: top;
        }
        tr:hover td {
          background: #12121a;
        }
        .severity-cell {
          font-weight: 700;
          white-space: nowrap;
        }
        .empty {
          color: #606880;
          text-align: center;
          padding: 40px 16px;
          border: 1px dashed #1e1e2e;
          border-radius: 14px;
        }
        .section {
          margin-top: 18px;
          padding: 16px;
          border-radius: 14px;
          border: 1px solid #1e1e2e;
          background: #12121a;
        }
        .section-title {
          margin: 0 0 10px;
          font-size: 12px;
          font-weight: 700;
          color: #c4b5fd;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .section-copy {
          margin: 0;
          color: #a5b0c2;
        }
        .pill-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }
        .pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid #2a2a3e;
          background: #171822;
          color: #d8def0;
          font-size: 12px;
        }
        .stack {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 12px;
          margin-top: 12px;
        }
        .stack-card {
          border-radius: 14px;
          border: 1px solid #222436;
          background: #171822;
          padding: 14px;
        }
        .stack-card strong {
          display: block;
          margin-bottom: 8px;
          color: #f5f3ff;
        }
        .stack-card span {
          color: #a5b0c2;
        }
        .code-block {
          margin-top: 12px;
          padding: 14px;
          border-radius: 14px;
          background: #090a0f;
          border: 1px solid #1e1e2e;
          color: #d8def0;
          white-space: pre-wrap;
          word-break: break-word;
          font-size: 12px;
          overflow-x: auto;
        }
        .muted {
          color: #7b8299;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="eyebrow">ShieldOps AI</div>
        <h1>${title}</h1>
        <p class="sub">ShieldOps AI — ${new Date().toLocaleTimeString()}</p>
        <p>${summary}</p>
        <div class="meta">
          ${statCards || `
            <div class="meta-card"><strong>File</strong><span>${escapeHtml(fileName)}</span></div>
            <div class="meta-card"><strong>Task</strong><span>${escapeHtml(task)}</span></div>
            <div class="meta-card"><strong>Web Route</strong><span>${route}</span></div>
          `}
        </div>
        ${taskBody}
      </div>
    </body>
  </html>`;
}

function extractFindings(result: unknown): Array<{ severity?: string; line?: string | number; message?: string; description?: string }> {
  if (!result || typeof result !== "object") {
    return [];
  }

  const data = result as Record<string, unknown>;
  const v2Scan = data.v2_scan;
  if (v2Scan && typeof v2Scan === "object") {
    const nested = v2Scan as Record<string, unknown>;
    const nestedFindings =
      asFindingArray(nested.issues) ||
      asFindingArray(nested.findings) ||
      asFindingArray(nested.results) ||
      asFindingArray(nested.all_issues);
    if (nestedFindings.length) {
      return nestedFindings;
    }
  }

  const direct = asFindingArray(data.issues) || asFindingArray(data.findings) || asFindingArray(data.results);
  if (direct.length) {
    return direct;
  }

  const vulnerabilityScan = data.vulnerability_scan;
  if (vulnerabilityScan && typeof vulnerabilityScan === "object") {
    const vulnerabilities = (vulnerabilityScan as Record<string, unknown>).vulnerabilities;
    return asFindingArray(vulnerabilities);
  }

  return [];
}

function asFindingArray(value: unknown): Array<{ severity?: string; line?: string | number; message?: string; description?: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      return { severity: "INFO", description: String(item || "") };
    }
    const row = item as Record<string, unknown>;
    return {
      severity: String(row.adjusted_severity || row.severity || row.level || row.priority || "INFO").toUpperCase(),
      line: normalizeLine(row.line ?? row.line_number ?? row.lineno),
      message: stringValue(row.message) || stringValue(row.title) || stringValue(row.summary),
      description: stringValue(row.description) || stringValue(row.issue) || stringValue(row.recommendation) || stringValue(row.why_it_matters),
    };
  }).filter((item) => item.message || item.description);
}

function extractStats(result: unknown, findingsCount: number): Array<{ label: string; value: string }> {
  const stats: Array<{ label: string; value: string }> = [];

  if (result && typeof result === "object") {
    const data = result as Record<string, unknown>;
    const v2Stats = getV2ScanStats(data);
    const totalFindings = stringValue(v2Stats.issues_found) || String(findingsCount);
    const score = stringValue(v2Stats.score) || stringValue(data.score) || stringValue((data.stats as Record<string, unknown> | undefined)?.score);
    const grade = stringValue(v2Stats.grade);
    const readiness = stringValue(v2Stats.readiness);
    const engine = stringValue(data.engine);
    const scanId = stringValue(data.scan_id);

    stats.push({ label: "Findings", value: totalFindings });
    if (score) stats.push({ label: "Security Score", value: grade ? `${score} (${grade})` : score });
    if (readiness) stats.push({ label: "Readiness", value: readiness });
    if (engine) stats.push({ label: "Engine", value: engine });
    if (scanId) stats.push({ label: "Scan ID", value: scanId });
  }

  return stats.slice(0, 4);
}

function renderTaskBody(
  task: ShieldOpsTask,
  result: unknown,
  findings: Array<{ severity?: string; line?: string | number; message?: string; description?: string }>,
): string {
  switch (task) {
    case "analyze":
      return renderAnalyzeSection(result, findings);
    case "autofix":
      return renderAutofixSection(result, findings);
    case "sbom":
      return renderSbomSection(result, findings);
    case "compose":
      return renderComposeSection(result, findings);
    case "k8s":
      return renderK8sSection(result, findings);
    case "cost":
      return renderCostSection(result, findings);
    case "compose_generator":
      return renderComposeGeneratorSection(result, findings);
    default:
      return renderFindingsSection(findings);
  }
}

function renderAnalyzeSection(
  result: unknown,
  findings: Array<{ severity?: string; line?: string | number; message?: string; description?: string }>,
): string {
  const data = asRecord(result);
  const v2Stats = getV2ScanStats(data);
  const v2Scan = asRecord(data.v2_scan);
  const breakdown = asRecord(v2Stats.breakdown);
  const summary = stringValue(v2Scan.summary) || "Report-aligned scan summary for the current Dockerfile.";
  const score = stringValue(v2Stats.score) || "Not available";
  const grade = stringValue(v2Stats.grade) || "N/A";
  const readiness = stringValue(v2Stats.readiness) || "Needs review";
  const baseImage = stringValue(v2Scan.base_image) || "Unknown";
  const counts = [
    { label: "High", value: stringValue(asRecord(breakdown.HIGH).count) || "0" },
    { label: "Medium", value: stringValue(asRecord(breakdown.MEDIUM).count) || "0" },
    { label: "Low", value: stringValue(asRecord(breakdown.LOW).count) || "0" },
    { label: "Total Issues", value: stringValue(v2Stats.issues_found) || String(findings.length) },
  ];

  return `
    <div class="section">
      <h2 class="section-title">Dockerfile Report Summary</h2>
      <p class="section-copy">${escapeHtml(summary)}</p>
      <div class="stack">
        <div class="stack-card"><strong>Security Score</strong><span>${escapeHtml(score)}</span></div>
        <div class="stack-card"><strong>Grade</strong><span>${escapeHtml(grade)}</span></div>
        <div class="stack-card"><strong>Readiness</strong><span>${escapeHtml(readiness)}</span></div>
        <div class="stack-card"><strong>Base Image</strong><span>${escapeHtml(baseImage)}</span></div>
      </div>
      <div class="stack">
        ${counts.map((item) => `
          <div class="stack-card"><strong>${escapeHtml(item.label)}</strong><span>${escapeHtml(item.value)}</span></div>
        `).join("")}
      </div>
    </div>
    ${renderFindingsSection(findings)}
  `;
}

function renderAutofixSection(
  result: unknown,
  findings: Array<{ severity?: string; line?: string | number; message?: string; description?: string }>,
): string {
  const data = asRecord(result);
  const fixedContent =
    stringValue(data.fixed_content) ||
    stringValue(data.fixed_dockerfile) ||
    stringValue(data.updated_content);
  const changes = [
    stringValue(data.summary),
    stringValue(data.fix_summary),
    stringValue(data.applied_fix),
  ].filter(Boolean);

  return `
    <div class="section">
      <h2 class="section-title">AutoFix Result</h2>
      <p class="section-copy">ShieldOps generated a fix suggestion for the current Dockerfile.</p>
      ${changes.length
        ? `<div class="pill-row">${changes.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}</div>`
        : `<p class="muted">No explicit fix summary was returned by the API.</p>`}
      ${fixedContent
        ? `<pre class="code-block">${escapeHtml(truncateBlock(fixedContent))}</pre>`
        : `<div class="empty">No fixed Dockerfile preview was returned.</div>`}
    </div>
    ${renderFindingsSection(findings)}
  `;
}

function renderSbomSection(
  result: unknown,
  findings: Array<{ severity?: string; line?: string | number; message?: string; description?: string }>,
): string {
  const data = asRecord(result);
  const packages = Array.isArray(data.components) ? data.components.length : Array.isArray(data.packages) ? data.packages.length : 0;
  const vulnerabilityData = asRecord(data.vulnerability_scan);
  const vulnerabilities = Array.isArray(vulnerabilityData.vulnerabilities)
    ? vulnerabilityData.vulnerabilities.length
    : findings.length;

  return `
    <div class="section">
      <h2 class="section-title">SBOM Snapshot</h2>
      <div class="stack">
        <div class="stack-card"><strong>Components</strong><span>${escapeHtml(String(packages))}</span></div>
        <div class="stack-card"><strong>Vulnerabilities</strong><span>${escapeHtml(String(vulnerabilities))}</span></div>
      </div>
    </div>
    ${renderFindingsSection(findings)}
  `;
}

function renderComposeSection(
  result: unknown,
  findings: Array<{ severity?: string; line?: string | number; message?: string; description?: string }>,
): string {
  const data = asRecord(result);
  const services = Array.isArray(data.services) ? data.services : [];
  const servicePills = services
    .map((item) => stringValue(asRecord(item).name) || stringValue(item))
    .filter(Boolean)
    .slice(0, 8);

  return `
    <div class="section">
      <h2 class="section-title">Compose Scan</h2>
      <p class="section-copy">Service-level hints are shown here when the backend returns them.</p>
      ${servicePills.length
        ? `<div class="pill-row">${servicePills.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}</div>`
        : `<p class="muted">No per-service metadata was returned for this scan.</p>`}
    </div>
    ${renderFindingsSection(findings)}
  `;
}

function renderK8sSection(
  result: unknown,
  findings: Array<{ severity?: string; line?: string | number; message?: string; description?: string }>,
): string {
  const data = asRecord(result);
  const categories = [
    stringValue(data.cluster_context),
    stringValue(data.policy_pack),
    stringValue(data.framework),
    stringValue(data.namespace),
  ].filter(Boolean);

  return `
    <div class="section">
      <h2 class="section-title">Kubernetes Scan</h2>
      ${categories.length
        ? `<div class="pill-row">${categories.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}</div>`
        : `<p class="muted">Policy and manifest metadata will appear here when available.</p>`}
    </div>
    ${renderFindingsSection(findings)}
  `;
}

function renderCostSection(
  result: unknown,
  findings: Array<{ severity?: string; line?: string | number; message?: string; description?: string }>,
): string {
  const data = asRecord(result);
  const monthlyCost =
    stringValue(data.monthly_cost) ||
    stringValue(data.estimated_monthly_cost) ||
    stringValue(data.total_monthly_cost);
  const notes = [
    stringValue(data.cost_summary),
    stringValue(data.recommendation),
    stringValue(data.summary),
  ].filter(Boolean);

  return `
    <div class="section">
      <h2 class="section-title">Cloud Cost Estimate</h2>
      <div class="stack">
        <div class="stack-card"><strong>Estimated Monthly Cost</strong><span>${escapeHtml(monthlyCost || "Not provided")}</span></div>
        <div class="stack-card"><strong>Optimization Notes</strong><span>${escapeHtml(String(notes.length))}</span></div>
      </div>
      ${notes.length
        ? `<div class="pill-row">${notes.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}</div>`
        : ""}
    </div>
    ${renderFindingsSection(findings)}
  `;
}

function renderComposeGeneratorSection(
  result: unknown,
  findings: Array<{ severity?: string; line?: string | number; message?: string; description?: string }>,
): string {
  const data = asRecord(result);
  const generatedCompose =
    stringValue(data.compose_yaml) ||
    stringValue(data.generated_compose) ||
    stringValue(data.content);
  const notes = [
    stringValue(data.summary),
    stringValue(data.generator),
    stringValue(data.template),
  ].filter(Boolean);

  return `
    <div class="section">
      <h2 class="section-title">Compose Generator Output</h2>
      ${notes.length ? `<div class="pill-row">${notes.map((item) => `<span class="pill">${escapeHtml(item)}</span>`).join("")}</div>` : ""}
      ${generatedCompose
        ? `<pre class="code-block">${escapeHtml(truncateBlock(generatedCompose))}</pre>`
        : `<div class="empty">No generated compose preview was returned.</div>`}
    </div>
    ${renderFindingsSection(findings)}
  `;
}

function renderFindingsSection(
  findings: Array<{ severity?: string; line?: string | number; message?: string; description?: string }>,
): string {
  if (findings.length === 0) {
    return `<div class="empty">No issues found.</div>`;
  }

  const rows = findings.map((item) => {
    const severity = escapeHtml(item.severity || "INFO");
    const color = severityColor(item.severity);
    const line = item.line ? `L${item.line}` : "—";
    const message = escapeHtml(item.message || item.description || "No description");
    return `
      <tr>
        <td class="severity-cell" style="color:${color}">${severity}</td>
        <td>${escapeHtml(line)}</td>
        <td>${message}${item.description && item.description !== item.message ? `<div class="muted" style="margin-top:4px;">${escapeHtml(item.description)}</div>` : ""}</td>
      </tr>
    `;
  }).join("");

  return `
    <div class="section">
      <div class="badge">${findings.length} issue${findings.length > 1 ? "s" : ""}</div>
      <table>
        <thead>
          <tr><th>Severity</th><th>Line</th><th>Description</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function getV2ScanStats(data: Record<string, unknown>): Record<string, unknown> {
  return asRecord(asRecord(data.v2_scan).stats);
}

function truncateBlock(value: string, maxLength = 2400): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}\n...` : value;
}

function stringValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function normalizeLine(value: unknown): string | number | undefined {
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }
  return undefined;
}

function severityColor(value?: string): string {
  const severity = String(value || "INFO").toUpperCase();
  if (severity === "CRITICAL" || severity === "HIGH") return "#ef4444";
  if (severity === "MEDIUM") return "#f59e0b";
  if (severity === "LOW") return "#10b981";
  return "#06B6D4";
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function getExtension(document: vscode.TextDocument): string {
  const dotIndex = document.fileName.lastIndexOf(".");
  if (dotIndex === -1) {
    return "";
  }
  return document.fileName.slice(dotIndex).toLowerCase();
}

function isDockerfileLike(basename: string, extension: string): boolean {
  return basename === "dockerfile" || extension === ".dockerfile";
}

function isComposeLike(basename: string): boolean {
  return new Set(["docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"]).has(basename);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getSidebarHtml(): string {
  const actions = [
    { label: "Analyze Current File", command: "shieldops-ai.analyzeCurrentFile" },
    { label: "AutoFix Dockerfile", command: "shieldops-ai.autofixCurrentDockerfile" },
    { label: "Generate SBOM", command: "shieldops-ai.generateSbomFromCurrentFile" },
    { label: "Scan Compose", command: "shieldops-ai.scanComposeCurrentFile" },
    { label: "Scan Kubernetes", command: "shieldops-ai.scanK8sCurrentFile" },
    { label: "Estimate Cloud Cost", command: "shieldops-ai.estimateCloudCostFromCurrentFile" },
    { label: "Generate Compose", command: "shieldops-ai.generateComposeFromCurrentFile" },
    { label: "Open Integration Hub", command: "shieldops-ai.openHub" },
  ];

  const buttons = actions.map((action) => `
    <button class="action" data-command="${escapeHtml(action.command)}">${escapeHtml(action.label)}</button>
  `).join("");

  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        body {
          margin: 0;
          padding: 14px;
          font-family: var(--vscode-font-family);
          color: var(--vscode-foreground);
          background: var(--vscode-sideBar-background);
        }
        .card {
          border: 1px solid var(--vscode-sideBar-border, var(--vscode-editorWidget-border));
          border-radius: 12px;
          padding: 12px;
          background: var(--vscode-editorWidget-background);
        }
        h2 {
          margin: 0 0 8px;
          font-size: 15px;
        }
        p {
          margin: 0 0 12px;
          color: var(--vscode-descriptionForeground);
          line-height: 1.45;
          font-size: 12px;
        }
        .actions {
          display: grid;
          gap: 8px;
        }
        .action {
          width: 100%;
          border: 1px solid var(--vscode-button-border, transparent);
          border-radius: 8px;
          padding: 8px 10px;
          text-align: left;
          cursor: pointer;
          color: var(--vscode-button-foreground);
          background: var(--vscode-button-background);
        }
        .action:hover {
          background: var(--vscode-button-hoverBackground);
        }
      </style>
    </head>
    <body>
      <div class="card">
        <h2>ShieldOps AI</h2>
        <p>Run the current file through ShieldOps directly from the sidebar.</p>
        <div class="actions">${buttons}</div>
      </div>
      <script>
        const vscode = acquireVsCodeApi();
        for (const button of document.querySelectorAll(".action")) {
          button.addEventListener("click", () => {
            vscode.postMessage({ command: button.dataset.command });
          });
        }
      </script>
    </body>
  </html>`;
}

export function deactivate() {}
