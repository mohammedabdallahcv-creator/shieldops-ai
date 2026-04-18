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
        await openExternal(baseUrl, payload.route || TASK_ROUTE_MAP[task]);
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
  const configured = String(config.get("baseUrl") || "http://127.0.0.1:5000").trim();
  return configured.replace(/\/+$/, "");
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
  const rows = findings.map((item) => {
    const severity = escapeHtml(item.severity || "INFO");
    const color = severityColor(item.severity);
    const line = item.line ? `L${item.line}` : "—";
    const message = escapeHtml(item.message || item.description || "No description");
    return `
      <tr>
        <td class="severity-cell" style="color:${color}">${severity}</td>
        <td>${escapeHtml(line)}</td>
        <td>${message}</td>
      </tr>
    `;
  }).join("");
  const statCards = stats.map((item) => `
    <div class="meta-card">
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.value)}</span>
    </div>
  `).join("");

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
        ${findings.length === 0
          ? `<div class="empty">No issues found.</div>`
          : `
            <div class="badge">${findings.length} issue${findings.length > 1 ? "s" : ""} found</div>
            <table>
              <thead>
                <tr><th>Severity</th><th>Line</th><th>Description</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          `}
      </div>
    </body>
  </html>`;
}

function extractFindings(result: unknown): Array<{ severity?: string; line?: string | number; message?: string; description?: string }> {
  if (!result || typeof result !== "object") {
    return [];
  }

  const data = result as Record<string, unknown>;
  const direct = asFindingArray(data.issues) || asFindingArray(data.findings) || asFindingArray(data.results);
  if (direct.length) {
    return direct;
  }

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
      severity: String(row.severity || row.level || row.priority || "INFO").toUpperCase(),
      line: normalizeLine(row.line ?? row.line_number ?? row.lineno),
      message: stringValue(row.message) || stringValue(row.title),
      description: stringValue(row.description) || stringValue(row.issue) || stringValue(row.recommendation),
    };
  }).filter((item) => item.message || item.description);
}

function extractStats(result: unknown, findingsCount: number): Array<{ label: string; value: string }> {
  const stats: Array<{ label: string; value: string }> = [];

  stats.push({ label: "Issues", value: String(findingsCount) });

  if (result && typeof result === "object") {
    const data = result as Record<string, unknown>;
    const score = stringValue(data.score) || stringValue((data.stats as Record<string, unknown> | undefined)?.score);
    const engine = stringValue(data.engine);
    const scanId = stringValue(data.scan_id);
    const success = typeof data.success === "boolean" ? (data.success ? "Yes" : "No") : "";

    if (score) stats.push({ label: "Score", value: score });
    if (engine) stats.push({ label: "Engine", value: engine });
    if (scanId) stats.push({ label: "Scan ID", value: scanId });
    if (success) stats.push({ label: "Success", value: success });
  }

  return stats.slice(0, 4);
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

export function deactivate() {}
