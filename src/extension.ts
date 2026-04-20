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

type ReportContract = {
  securityScore?: string;
  securityScoreGrade?: string;
  readinessScore?: string;
  readinessGrade?: string;
  totalIssues?: string;
  criticalCount?: string;
  highCount?: string;
  mediumCount?: string;
  lowCount?: string;
  detailedIssues?: FindingRow[];
  summary?: Record<string, unknown>;
  decisionContract?: Record<string, unknown>;
  executiveSignal?: Record<string, unknown>;
  quickActions?: string[];
  riskPosture?: Record<string, unknown>;
  stats?: Record<string, unknown>;
};

type FindingRow = {
  ruleId?: string;
  severity?: string;
  line?: string | number;
  message?: string;
  description?: string;
};

type AnalyzeViewData = {
  result: unknown;
  findings: FindingRow[];
  webAppUrl: string;
  payload?: ExtensionApiResponse;
  fileName?: string;
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

const USE_LEAN_UI = true;

const v2Styles = `
<style>
.card-lean {
  max-width: 940px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.legacy-shell-hidden {
  display: none;
}

.shieldops-v2 {
  padding: 20px;
  color: #e6edf3;
}

.shieldops-v2,
.shieldops-v2 * {
  box-sizing: border-box;
}

.shieldops-v2 {
  overflow-wrap: anywhere;
}

.shieldops-v2-badge {
  display: inline-block;
  margin-bottom: 14px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(123, 97, 255, 0.12);
  border: 1px solid rgba(123, 97, 255, 0.24);
  color: #cbb6ff;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: .08em;
}

.shieldops-v2-title {
  margin: 0 0 8px;
  font-size: 34px;
  font-weight: 800;
  color: #ffffff;
}

.shieldops-v2-subtitle {
  margin-bottom: 20px;
  color: #9fb0c0;
  line-height: 1.7;
}

.v2-hero {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.v2-metric,
.v2-decision,
.v2-section,
.v2-details {
  border: 1px solid rgba(80, 140, 255, 0.15);
  border-radius: 18px;
  background: rgba(8, 12, 28, 0.85);
}

.v2-metric {
  padding: 18px;
}

.v2-metric-label {
  margin-bottom: 8px;
  color: #9fb0c0;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.v2-metric-value {
  font-size: 28px;
  font-weight: 800;
  color: #ffffff;
}

.v2-metric-value span {
  color: #b8c7d6;
  font-size: 18px;
}

.v2-decision {
  margin-bottom: 18px;
  padding: 16px 18px;
}

.v2-decision.high {
  border-color: rgba(255, 106, 106, 0.28);
  background: rgba(255, 70, 70, 0.06);
}

.v2-decision.medium {
  border-color: rgba(255, 208, 92, 0.28);
  background: rgba(255, 208, 92, 0.06);
}

.v2-decision.low {
  border-color: rgba(102, 240, 179, 0.28);
  background: rgba(102, 240, 179, 0.06);
}

.v2-decision.neutral {
  border-color: rgba(80, 140, 255, 0.15);
  background: rgba(8, 12, 28, 0.85);
}

.v2-decision-label {
  margin-bottom: 6px;
  color: #ffb86b;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .06em;
}

.v2-decision-text {
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.6;
}

.v2-section {
  margin-bottom: 16px;
  padding: 16px 18px;
}

.v2-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.v2-section-title {
  margin-bottom: 10px;
  color: #d8e4ff;
  font-size: 13px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: .08em;
}

.v2-section-header .v2-section-title {
  margin-bottom: 0;
}

.v2-section-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.v2-findings-note {
  margin-bottom: 12px;
  color: #93a4b5;
  line-height: 1.6;
}

.v2-findings {
  display: grid;
  gap: 12px;
}

.v2-finding-card {
  padding: 14px;
  border-radius: 14px;
  background: rgba(14, 20, 38, 0.95);
  border: 1px solid rgba(255,255,255,0.06);
}

.v2-finding-card:first-child {
  border-color: rgba(255, 178, 92, 0.34);
  box-shadow: 0 0 0 1px rgba(255, 178, 92, 0.10);
}

.v2-finding-severity {
  display: inline-block;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .06em;
}

.v2-severity-critical { color: #ff6b8a; }
.v2-severity-high { color: #ffb25c; }
.v2-severity-medium { color: #ffd36a; }
.v2-severity-low { color: #76d9ff; }
.v2-severity-info { color: #66f0b3; }

.v2-finding-title {
  margin-bottom: 8px;
  color: #ffffff;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.6;
}

.v2-finding-desc {
  color: #a9b8c8;
  line-height: 1.7;
}

.v2-collapsible[data-collapsed="true"] .v2-collapsible-item.is-extra {
  display: none;
}

.v2-list {
  display: grid;
  gap: 10px;
}

.v2-list-item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: flex-start;
  color: #dce7f2;
  line-height: 1.7;
}

.v2-list-text,
.v2-finding-title,
.v2-finding-desc,
.v2-detail-value,
.v2-empty-state {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.v2-list-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: rgba(0, 212, 255, 0.12);
  color: #7ee7ff;
  font-size: 12px;
  font-weight: 800;
  flex-shrink: 0;
}

.v2-copy-btn,
.v2-collapse-btn,
.v2-secondary-btn {
  border: 1px solid rgba(126, 231, 255, 0.22);
  border-radius: 8px;
  background: rgba(126, 231, 255, 0.08);
  color: #9fdcff;
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
}

.v2-copy-btn {
  min-width: 70px;
  min-height: 30px;
  padding: 0 10px;
}

.v2-copy-btn.is-copied {
  border-color: rgba(102, 240, 179, 0.35);
  background: rgba(102, 240, 179, 0.12);
  color: #66f0b3;
}

.v2-collapse-btn,
.v2-secondary-btn {
  min-height: 32px;
  padding: 0 12px;
}

.v2-copy-btn:hover,
.v2-collapse-btn:hover,
.v2-secondary-btn:hover {
  border-color: rgba(126, 231, 255, 0.42);
  background: rgba(126, 231, 255, 0.14);
}

.v2-copy-btn:disabled,
.v2-collapse-btn:disabled,
.v2-secondary-btn:disabled,
.shieldops-btn[aria-disabled="true"] {
  cursor: not-allowed;
  opacity: 0.58;
}

.v2-details {
  margin-bottom: 16px;
  padding: 14px 18px;
}

.v2-details summary {
  cursor: pointer;
  color: #9fdcff;
  font-weight: 700;
}

.v2-details-grid {
  display: grid;
  gap: 12px;
  margin-top: 14px;
}

.v2-detail-card {
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(14, 20, 38, 0.95);
  border: 1px solid rgba(255,255,255,0.06);
}

.v2-detail-label {
  margin-bottom: 6px;
  color: #93a4b5;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.v2-detail-value {
  color: #ffffff;
  line-height: 1.7;
}

.v2-actions {
  display: flex;
  justify-content: stretch;
}

.v2-actions .shieldops-btn,
.v2-actions button {
  width: 100%;
  min-height: 44px;
  font-weight: 800;
}

.v2-full-report {
  margin-bottom: 0;
}

.v2-empty-state,
.v2-loading-state,
.v2-error-state {
  border: 1px dashed rgba(159, 220, 255, 0.18);
  border-radius: 14px;
  background: rgba(14, 20, 38, 0.72);
  color: #a9b8c8;
  line-height: 1.7;
  padding: 14px;
}

.v2-loading-state,
.v2-error-state {
  margin-bottom: 16px;
}

.v2-loading-state {
  display: flex;
  align-items: center;
  gap: 10px;
}

.v2-loading-state[hidden] {
  display: none;
}

.v2-loading-dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  background: #7ee7ff;
  box-shadow: 0 0 0 rgba(126, 231, 255, 0.45);
  animation: v2Pulse 1.15s ease-in-out infinite;
  flex-shrink: 0;
}

.v2-error-state {
  border-color: rgba(255, 106, 106, 0.26);
  background: rgba(255, 70, 70, 0.06);
}

.v2-error-title {
  margin-bottom: 6px;
  color: #ffb0b0;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.v2-error-copy {
  margin-bottom: 12px;
  color: #ffd6d6;
}

.v2-error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.shieldops-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  font-weight: 800;
  text-decoration: none;
}

.shieldops-btn-primary {
  background: #8a73ff;
  border-color: rgba(203, 182, 255, 0.38);
  color: #ffffff;
  box-shadow: 0 10px 24px rgba(123, 97, 255, 0.26);
}

.shieldops-btn-primary:hover {
  background: #9a86ff;
  border-color: rgba(203, 182, 255, 0.52);
}

@keyframes v2Pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(126, 231, 255, 0.34);
  }
  70% {
    box-shadow: 0 0 0 8px rgba(126, 231, 255, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(126, 231, 255, 0);
  }
}

@media (max-width: 700px) {
  .v2-hero {
    grid-template-columns: 1fr;
  }

  .shieldops-v2-title {
    font-size: 28px;
  }

  .v2-list-item {
    grid-template-columns: 22px minmax(0, 1fr);
  }

  .v2-copy-btn {
    grid-column: 2;
    justify-self: start;
  }

  .v2-section-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .v2-section-actions,
  .v2-collapse-btn {
    width: 100%;
  }

  .v2-error-actions {
    flex-direction: column;
  }
}
</style>
`;

function renderResultPanelScript(nonce: string): string {
  return `
      <script nonce="${nonce}">
        (() => {
          const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : undefined;
          let loading = false;
          const loadingState = document.querySelector("[data-loading-state]");
          const loadingLabel = document.querySelector("[data-loading-label]");

          function setLoading(next, label) {
            loading = next;
            document.body.classList.toggle("is-loading", next);
            if (loadingState) {
              loadingState.hidden = !next;
            }
            if (loadingLabel && label) {
              loadingLabel.textContent = label;
            }
            for (const control of document.querySelectorAll("[data-disable-on-loading]")) {
              if ("disabled" in control) {
                control.disabled = next;
              } else {
                control.setAttribute("aria-disabled", String(next));
              }
            }
          }

          async function copyPlainText(text) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(text);
              return;
            }

            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.setAttribute("readonly", "true");
            textarea.style.position = "fixed";
            textarea.style.left = "-9999px";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            textarea.remove();
          }

          function showCopied(button) {
            const original = button.getAttribute("data-original-label") || button.textContent || "Copy";
            button.setAttribute("data-original-label", original);
            button.textContent = "Copied";
            button.classList.add("is-copied");
            window.setTimeout(() => {
              button.textContent = original;
              button.classList.remove("is-copied");
            }, 1200);
          }

          document.addEventListener("click", async (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target) {
              return;
            }

            const disabledLink = target.closest("a[aria-disabled='true']");
            if (disabledLink) {
              event.preventDefault();
              return;
            }

            const toggleButton = target.closest("[data-toggle-collapse]");
            if (toggleButton) {
              event.preventDefault();
              const collapseId = toggleButton.getAttribute("data-toggle-collapse");
              const section = document.querySelector("[data-collapse-id='" + collapseId + "']");
              if (!section) {
                return;
              }
              const isCollapsed = section.getAttribute("data-collapsed") !== "false";
              section.setAttribute("data-collapsed", isCollapsed ? "false" : "true");
              toggleButton.textContent = isCollapsed ? "Show Less" : "Show All";
              toggleButton.setAttribute("aria-expanded", String(isCollapsed));
              return;
            }

            const copyButton = target.closest("[data-copy-text]");
            if (copyButton) {
              event.preventDefault();
              if (loading) {
                return;
              }
              const text = copyButton.getAttribute("data-copy-text") || "";
              try {
                await copyPlainText(text);
                showCopied(copyButton);
              } catch {
                copyButton.textContent = "Failed";
                window.setTimeout(() => {
                  copyButton.textContent = copyButton.getAttribute("data-original-label") || "Copy";
                }, 1200);
              }
              return;
            }

            const reportButton = target.closest("[data-open-report]");
            if (reportButton) {
              event.preventDefault();
              if (loading) {
                return;
              }
              setLoading(true, "Opening full report...");
              if (vscode) {
                vscode.postMessage({
                  command: "openReport",
                  url: reportButton.getAttribute("data-open-report") || ""
                });
              }
              window.setTimeout(() => setLoading(false), 900);
              return;
            }

            const retryButton = target.closest("[data-retry-analysis]");
            if (retryButton) {
              event.preventDefault();
              if (loading) {
                return;
              }
              setLoading(true, "Retrying analysis...");
              if (vscode) {
                vscode.postMessage({ command: "retryAnalysis" });
              }
            }
          });
        })();
      </script>
  `;
}

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
        let targetRoute = payload.route || TASK_ROUTE_MAP[task];
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
  const configured = String(config.get("baseUrl") || "https://docker-analyzer-42bu.onrender.com").trim();
  const normalized = configured.replace(/\/+$/, "");
  if (!normalized) {
    return "https://docker-analyzer-42bu.onrender.com";
  }
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(normalized)) {
    return "https://docker-analyzer-42bu.onrender.com";
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

function normalizeExternalUrl(target: string, baseUrl: string): string {
  const trimmed = target.trim();
  if (!trimmed) {
    return "";
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.startsWith("/")) {
    return `${baseUrl}${trimmed}`;
  }
  return "";
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
    { enableFindWidget: true, enableScripts: true },
  );
  const nonce = getNonce();

  panel.webview.onDidReceiveMessage(async (message) => {
    const command = String(message?.command || "");
    if (command === "openReport") {
      const targetUrl = normalizeExternalUrl(String(message?.url || ""), buildBaseUrl());
      if (targetUrl) {
        await vscode.env.openExternal(vscode.Uri.parse(targetUrl));
      }
      return;
    }
    if (command === "retryAnalysis" && task === "analyze") {
      await vscode.commands.executeCommand("shieldops-ai.analyzeCurrentFile");
    }
  });

  const summary = escapeHtml(payload.summary || `${TASK_LABELS[task]} completed.`);
  const title = escapeHtml(payload.title || TASK_LABELS[task]);
  const route = escapeHtml(payload.route || TASK_ROUTE_MAP[task]);
  const webAppUrl = escapeHtml(buildWebAppUrl(buildBaseUrl(), task, payload));
  const result = payload.result;
  const findings = extractFindings(result);
  const stats = extractStats(result, findings.length);
  const statCards = stats.map((item) => `
    <div class="meta-card">
      <strong>${escapeHtml(item.label)}</strong>
      <span>${escapeHtml(item.value)}</span>
    </div>
  `).join("");
  const taskBody = renderTaskBody(task, result, findings, webAppUrl, payload, fileName);
  const useLeanAnalyzeUi = task === "analyze" && USE_LEAN_UI;

  panel.webview.html = `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
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
      ${v2Styles}
    </head>
    <body>
      <div class="card${useLeanAnalyzeUi ? " card-lean" : ""}">
        <div class="${useLeanAnalyzeUi ? "legacy-shell-hidden" : ""}">
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
        </div>
        ${taskBody}
      </div>
      ${renderResultPanelScript(nonce)}
    </body>
  </html>`;
}

function extractFindings(result: unknown): FindingRow[] {
  if (!result || typeof result !== "object") {
    return [];
  }

  const data = result as Record<string, unknown>;
  const analysisV2 = asRecord(data.analysis_v2);
  const normalizedFindings = asFindingArray(analysisV2.normalized_findings);
  if (normalizedFindings.length) {
    return dedupeFindings(normalizedFindings);
  }
  const v2Scan = data.v2_scan;
  if (v2Scan && typeof v2Scan === "object") {
    const nested = v2Scan as Record<string, unknown>;
    const nestedFindings = firstNonEmptyFindingArray(
      nested.issues,
      nested.findings,
      nested.results,
      nested.all_issues,
    );
    if (nestedFindings.length) {
      return dedupeFindings(nestedFindings);
    }
  }

  const direct = firstNonEmptyFindingArray(data.issues, data.findings, data.results);
  if (direct.length) {
    return dedupeFindings(direct);
  }

  const vulnerabilityScan = data.vulnerability_scan;
  if (vulnerabilityScan && typeof vulnerabilityScan === "object") {
    const vulnerabilities = (vulnerabilityScan as Record<string, unknown>).vulnerabilities;
    return dedupeFindings(asFindingArray(vulnerabilities));
  }

  return [];
}

function firstNonEmptyFindingArray(...values: unknown[]): FindingRow[] {
  for (const value of values) {
    const findings = asFindingArray(value);
    if (findings.length) {
      return findings;
    }
  }
  return [];
}

function asFindingArray(value: unknown): FindingRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => {
    if (!item || typeof item !== "object") {
      return { severity: "INFO", description: String(item || "") };
    }
    const row = item as Record<string, unknown>;
    return {
      ruleId: stringValue(row.rule_id || row.ruleId || row.id),
      severity: String(row.adjusted_severity || row.severity || row.level || row.priority || "INFO").toUpperCase(),
      line: normalizeLine(row.line ?? row.line_number ?? row.lineno),
      message: stringValue(row.message) || stringValue(row.title) || stringValue(row.summary),
      description: stringValue(row.description) || stringValue(row.issue) || stringValue(row.recommendation) || stringValue(row.why_it_matters),
    };
  }).filter((item) => item.message || item.description);
}

function canonicalRuleId(value?: string): string {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "pip-no-cache-dir-missing") return "pip-no-cache";
  if (normalized === "workdir-position-check") return "workdir-after-copy";
  return normalized;
}

function dedupeFindings(findings: FindingRow[]): FindingRow[] {
  const deduped = new Map<string, FindingRow>();
  for (const item of findings) {
    const key = [
      canonicalRuleId(item.ruleId),
      String(item.line || ""),
      String(item.message || item.description || "").trim().toLowerCase(),
    ].join("|");
    if (!deduped.has(key)) {
      deduped.set(key, item);
      continue;
    }
    const existing = deduped.get(key)!;
    if (!existing.description && item.description) {
      existing.description = item.description;
    }
    if (!existing.message && item.message) {
      existing.message = item.message;
    }
  }
  return [...deduped.values()];
}

function extractStats(result: unknown, findingsCount: number): Array<{ label: string; value: string }> {
  const stats: Array<{ label: string; value: string }> = [];

  if (result && typeof result === "object") {
    const data = result as Record<string, unknown>;
    const contract = getReportContract(data);
    const v2Stats = getV2ScanStats(data);
    const summary = asRecord(data.summary);
    const analysisV2 = asRecord(data.analysis_v2);
    const decisionSummary = asRecord(analysisV2.decision_summary);
    const scoreV3 = asRecord(analysisV2.score_v3);
    const totalFindings =
      contract.totalIssues ||
      stringValue(v2Stats.issues_found) ||
      stringValue(data.issues_count) ||
      stringValue(summary.total_issues) ||
      String(findingsCount);
    const score =
      contract.securityScore ||
      formatPercent(data.security_score) ||
      formatPercent(decisionSummary.score) ||
      formatPercent(data.score) ||
      formatPercent(v2Stats.score) ||
      formatPercent((data.stats as Record<string, unknown> | undefined)?.score);
    const secGrade = contract.securityScoreGrade || stringValue(v2Stats.grade);
    const readiness =
      contract.readinessScore ||
      formatPercent(scoreV3.score) ||
      formatPercent(data.readiness_score) ||
      formatPercent(v2Stats.score) ||
      stringValue(v2Stats.readiness);
    const readGrade = contract.readinessGrade || "";
    const engine = displayEngineName(stringValue(data.engine));
    const scanId = stringValue(data.scan_id);

    stats.push({ label: "Findings", value: totalFindings });
    if (score) stats.push({ label: "Security Score", value: secGrade ? `${score} (${secGrade})` : score });
    if (readiness) stats.push({ label: "Readiness", value: readGrade ? `${readiness} (${readGrade})` : readiness });
    if (engine) stats.push({ label: "Engine", value: engine });
    if (scanId) stats.push({ label: "Scan ID", value: scanId });
  }

  return stats.slice(0, 4);
}

function renderTaskBody(
  task: ShieldOpsTask,
  result: unknown,
  findings: FindingRow[],
  webAppUrl: string,
  payload?: ExtensionApiResponse,
  fileName?: string,
): string {
  switch (task) {
    case "analyze":
      return renderAnalyzeSection({ result, findings, webAppUrl, payload, fileName });
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

function renderAnalyzeSection(data: AnalyzeViewData): string {
  return USE_LEAN_UI
    ? renderAnalyzeSectionV2(data)
    : renderAnalyzeSectionV1(data);
}

function renderAnalyzeSectionV2(viewData: AnalyzeViewData): string {
  const { result, findings, webAppUrl, payload, fileName } = viewData;
  const data = asRecord(result);
  const reportContract = asRecord(data.report_contract);
  const contract = getReportContract(data);
  const v2Stats = getV2ScanStats(data);
  const analysisV2 = asRecord(data.analysis_v2);
  const decisionSummary = asRecord(analysisV2.decision_summary);
  const scoreV3 = asRecord(analysisV2.score_v3);

  const displayFindings =
    contract.detailedIssues && contract.detailedIssues.length > 0
      ? contract.detailedIssues
      : findings;

  const securityPercent =
    formatPercent(reportContract.security_score_percent) ||
    contract.securityScore ||
    formatPercent(reportContract.security_score) ||
    formatPercent(data.security_score) ||
    formatPercent(decisionSummary.score) ||
    formatPercent(data.score) ||
    formatPercent(v2Stats.score) ||
    "0%";

  const securityGrade =
    contract.securityScoreGrade ||
    stringValue(reportContract.security_score_grade) ||
    stringValue(v2Stats.grade) ||
    "N/A";

  const readinessPercent =
    formatPercent(reportContract.production_readiness_percent) ||
    contract.readinessScore ||
    formatPercent(reportContract.readiness_score) ||
    formatPercent(scoreV3.score) ||
    formatPercent(data.readiness_score) ||
    formatPercent(v2Stats.score) ||
    stringValue(v2Stats.readiness) ||
    "0%";

  const readinessGrade =
    contract.readinessGrade ||
    stringValue(reportContract.production_readiness_grade) ||
    stringValue(reportContract.readiness_grade) ||
    "N/A";

  const totalFindings =
    contract.totalIssues ||
    stringValue(reportContract.total_issues) ||
    stringValue(data.issues_count) ||
    String(displayFindings.length);
  const numericTotalFindings = Number(totalFindings) || displayFindings.length;

  const criticalCount = contract.criticalCount || stringValue(reportContract.critical_count) || "0";
  const highCount = contract.highCount || stringValue(reportContract.high_count) || "0";
  const mediumCount = contract.mediumCount || stringValue(reportContract.medium_count) || "0";
  const lowCount = contract.lowCount || stringValue(reportContract.low_count) || "0";

  const decision = contract.decisionContract;
  const quickActions = contract.quickActions ?? [];
  const topFindings = [...displayFindings]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .filter((item) => item.message || item.description);

  const riskLabel =
    stringValue(decision?.risk_label) ||
    stringValue(decision?.risk_level) ||
    "Review recommended";

  const decisionText =
    stringValue(decision?.decision_text) ||
    stringValue(decision?.decision) ||
    "Review required before release";

  const rawRisk = String(riskLabel || "").toLowerCase();
  const riskClass = rawRisk.includes("high")
    ? "high"
    : rawRisk.includes("medium")
      ? "medium"
      : rawRisk.includes("low")
        ? "low"
        : "neutral";

  const analyzedFileName =
    stringValue(data.fileName) ||
    stringValue(data.file_name) ||
    stringValue(data.filename) ||
    stringValue(fileName);
  const hasAnalyzedFile = Boolean(analyzedFileName);
  const analyzedFileLabel = hasAnalyzedFile ? analyzedFileName : "current file";
  const normalizedFileName = analyzedFileName.toLowerCase();
  const analyzedBasename = normalizedFileName.split(/[\\/]/).pop() || normalizedFileName;
  const analyzedExtensionIndex = analyzedBasename.lastIndexOf(".");
  const analyzedExtension = analyzedExtensionIndex === -1 ? "" : analyzedBasename.slice(analyzedExtensionIndex);
  const isUnsupportedAnalyzeFile = hasAnalyzedFile && !isDockerfileLike(analyzedBasename, analyzedExtension);

  const explicitReportUrl =
    stringValue(data.reportUrl) ||
    stringValue(data.report_url) ||
    stringValue(reportContract.report_url) ||
    stringValue(reportContract.full_report_url);
  const fullReportUrl = explicitReportUrl ? escapeHtml(explicitReportUrl) : "";
  const errorMessage =
    stringValue(payload?.error) ||
    stringValue(payload?.details) ||
    stringValue(data.error) ||
    stringValue(data.details);

  const hasExtraQuickActions = quickActions.length > 3;
  const quickActionsHtml = `
        <div class="v2-section v2-collapsible" data-collapse-id="quick-actions" data-collapsed="true">
          <div class="v2-section-header">
            <div class="v2-section-title">Quick Actions</div>
            ${hasExtraQuickActions
              ? `<div class="v2-section-actions">
                  <button class="v2-collapse-btn" type="button" data-toggle-collapse="quick-actions" data-disable-on-loading="1" aria-expanded="false">Show All</button>
                </div>`
              : ""}
          </div>
          ${quickActions.length
            ? `<div class="v2-list">
                ${quickActions
                  .map(
                    (action, index) => `
                      <div class="v2-list-item v2-collapsible-item${index >= 3 ? " is-extra" : ""}">
                        <span class="v2-list-index">${index + 1}</span>
                        <span class="v2-list-text">${escapeHtml(action)}</span>
                        <button class="v2-copy-btn" type="button" data-copy-text="${escapeHtml(action)}" data-disable-on-loading="1">Copy</button>
                      </div>
                    `,
                  )
                  .join("")}
              </div>`
            : `<div class="v2-empty-state">No quick actions were returned for this scan.</div>`}
        </div>
  `;

  const hasExtraFindings = topFindings.length > 3;
  const findingsEmptyMessage = numericTotalFindings > 0
    ? "Findings were counted, but no detailed finding rows were returned in this response."
    : "No findings were returned for this scan.";
  const findingsHtml = `
        <div class="v2-section v2-collapsible" data-collapse-id="top-findings" data-collapsed="true">
          <div class="v2-section-header">
            <div class="v2-section-title">Top Findings</div>
            ${hasExtraFindings
              ? `<div class="v2-section-actions">
                  <button class="v2-collapse-btn" type="button" data-toggle-collapse="top-findings" data-disable-on-loading="1" aria-expanded="false">Show All</button>
                </div>`
              : ""}
          </div>
          ${topFindings.length
            ? `<div class="v2-findings-note">
                Showing ${Math.min(topFindings.length, 3)} of ${topFindings.length} findings. Open the full report for the complete breakdown.
              </div>
              <div class="v2-findings">
                ${topFindings
                  .map((issue, index) => {
                    const severity = String(issue.severity || "INFO").toUpperCase();
                    const severityClass = severity.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "info";
                    const title = escapeHtml(issue.message || issue.description || "Untitled finding");
                    const description = escapeHtml(issue.description || "");

                    return `
                      <div class="v2-finding-card v2-collapsible-item${index >= 3 ? " is-extra" : ""}">
                        <div class="v2-finding-severity v2-severity-${severityClass}">
                          ${escapeHtml(severity)}
                        </div>
                        <div class="v2-finding-title">${title}</div>
                        ${
                          description && description !== title
                            ? `<div class="v2-finding-desc">${description}</div>`
                            : ""
                        }
                      </div>
                    `;
                  })
                  .join("")}
              </div>`
            : `<div class="v2-empty-state">${escapeHtml(findingsEmptyMessage)}</div>`}
        </div>
  `;

  const detailsHtml = `
        <details class="v2-details">
          <summary>Technical Details</summary>
          <div class="v2-details-grid">
            <div class="v2-detail-card">
              <div class="v2-detail-label">Total Findings</div>
              <div class="v2-detail-value">${escapeHtml(totalFindings)}</div>
            </div>
            <div class="v2-detail-card">
              <div class="v2-detail-label">Severity</div>
              <div class="v2-detail-value">
                Critical ${escapeHtml(criticalCount)} &middot; High ${escapeHtml(highCount)} &middot; Medium ${escapeHtml(mediumCount)} &middot; Low ${escapeHtml(lowCount)}
              </div>
            </div>
          </div>
        </details>
  `;

  const fileStateHtml = !hasAnalyzedFile
    ? `<div class="v2-empty-state">No file is associated with this analysis. Open a Dockerfile and retry the scan.</div>`
    : isUnsupportedAnalyzeFile
      ? `<div class="v2-empty-state">This file type is not supported for Dockerfile Analysis. Open a Dockerfile or *.dockerfile file and retry.</div>`
      : "";

  const loadingHtml = `
        <div class="v2-loading-state" data-loading-state hidden>
          <span class="v2-loading-dot"></span>
          <span data-loading-label>Analyzing Dockerfile...</span>
        </div>
  `;

  const errorHtml = errorMessage
    ? `
        <div class="v2-error-state">
          <div class="v2-error-title">Analysis Error</div>
          <div class="v2-error-copy">${escapeHtml(errorMessage)}</div>
          <div class="v2-error-actions">
            <button class="v2-secondary-btn" type="button" data-retry-analysis="1" data-disable-on-loading="1">Retry</button>
            ${webAppUrl
              ? `<button class="shieldops-btn v2-secondary-btn" type="button" data-open-report="${webAppUrl}" data-disable-on-loading="1">Open Platform</button>`
              : ""}
          </div>
        </div>
    `
    : "";

  const fullReportHtml = `
        <div class="v2-section v2-full-report">
          <div class="v2-section-title">Full Report</div>
          ${fullReportUrl
            ? `<div class="v2-actions">
                <button class="shieldops-btn shieldops-btn-primary" type="button" data-open-report="${fullReportUrl}" data-disable-on-loading="1">
                  Open Full Report
                </button>
              </div>`
            : `<div class="v2-empty-state">No report URL was returned for this scan.</div>`}
        </div>
  `;

  return `
        <section class="shieldops-v2">
          <div class="shieldops-v2-badge">SHIELDOPS AI</div>

          <h1 class="shieldops-v2-title">Dockerfile Analysis</h1>

          <div class="shieldops-v2-subtitle">
            Analysis completed for ${escapeHtml(analyzedFileLabel)}.
          </div>

          ${loadingHtml}
          ${fileStateHtml}

          <div class="v2-hero">
            <div class="v2-metric">
              <div class="v2-metric-label">Security</div>
              <div class="v2-metric-value">${escapeHtml(securityPercent)} <span>(${escapeHtml(securityGrade)})</span></div>
            </div>
            <div class="v2-metric">
              <div class="v2-metric-label">Readiness</div>
              <div class="v2-metric-value">${escapeHtml(readinessPercent)} <span>(${escapeHtml(readinessGrade)})</span></div>
            </div>
          </div>

          <div class="v2-decision ${riskClass}">
            <div class="v2-section-title">Risk Decision</div>
            <div class="v2-decision-label">${escapeHtml(riskLabel)}</div>
            <div class="v2-decision-text">${escapeHtml(decisionText)}</div>
          </div>

          ${errorHtml}
          ${findingsHtml}
          ${quickActionsHtml}
          ${detailsHtml}
          ${fullReportHtml}
        </section>
  `;
}

function renderAnalyzeSectionV1(viewData: AnalyzeViewData): string {
  const { result, findings, webAppUrl } = viewData;
  const data = asRecord(result);
  const contract = getReportContract(data);
  const v2Stats = getV2ScanStats(data);

  // ── Scores (prefer contract canonical fields) ──
  const score =
    contract.securityScore ||
    formatPercent(data.security_score) ||
    formatPercent(data.score) ||
    formatPercent(v2Stats.score) ||
    "N/A";
  const secGrade = contract.securityScoreGrade || stringValue(v2Stats.grade) || "N/A";
  const readiness =
    contract.readinessScore ||
    formatPercent(data.readiness_score) ||
    formatPercent(v2Stats.score) ||
    "N/A";
  const readGrade = contract.readinessGrade || "";
  const engine = displayEngineName(stringValue(data.engine));

  // ── Findings (prefer contract detailed_issues) ──
  const displayFindings =
    contract.detailedIssues && contract.detailedIssues.length > 0
      ? contract.detailedIssues
      : findings;
  const declaredFindings = Number(contract.totalIssues || String(displayFindings.length));

  const severityLine = [
    contract.criticalCount ? `Critical ${contract.criticalCount}` : "",
    contract.highCount ? `High ${contract.highCount}` : "",
    contract.mediumCount ? `Medium ${contract.mediumCount}` : "",
    contract.lowCount ? `Low ${contract.lowCount}` : "",
  ].filter(Boolean).join(" · ");

  // ── Decision / Risk Signal ──
  const dc = contract.decisionContract;
  const es = contract.executiveSignal;
  const rp = contract.riskPosture;
  let decisionSection = "";
  if (dc && (stringValue(dc.risk_level) || stringValue(dc.decision))) {
    const tier = stringValue(dc.tier);
    const accent = stringValue(rp?.accent) || (tier === "good" ? "#00ff88" : tier === "warning" ? "#ff9500" : "#ff3366");
    decisionSection = `
    <div class="section" style="border-left: 3px solid ${accent};">
      <h2 class="section-title">Risk &amp; Decision</h2>
      <div class="stack">
        <div class="stack-card"><strong>Risk Level</strong><span style="color:${accent}">${escapeHtml(stringValue(dc.risk_label) || stringValue(dc.risk_level) || "Unknown")}</span></div>
        <div class="stack-card"><strong>Decision</strong><span>${escapeHtml(stringValue(dc.decision_text) || stringValue(dc.decision) || "Review Required")}</span></div>
        ${es ? `<div class="stack-card"><strong>Deployment</strong><span>${escapeHtml(stringValue(es.deployment_value) || "N/A")}</span></div>` : ""}
      </div>
    </div>`;
  }

  // ── Analysis Summary breakdown ──
  const sm = contract.summary;
  let summarySection = "";
  if (sm) {
    const totalRules = stringValue(sm.total_rules) || "0";
    const passed = stringValue(sm.passed_rules_count) || "0";
    const failed = stringValue(sm.failed_rules_count) || "0";
    const autoFixable = stringValue(sm.auto_fixable_count) || "0";
    const secCount = stringValue(sm.security_count) || "0";
    const effCount = stringValue(sm.efficiency_count) || "0";
    const bpCount = stringValue(sm.best_practices_count) || "0";

    summarySection = `
    <div class="section">
      <h2 class="section-title">Analysis Summary</h2>
      <div class="stack">
        <div class="stack-card"><strong>Rules Checked</strong><span>${escapeHtml(totalRules)} (${escapeHtml(passed)} passed · ${escapeHtml(failed)} failed)</span></div>
        <div class="stack-card"><strong>Auto-Fixable</strong><span>${escapeHtml(autoFixable)}</span></div>
        <div class="stack-card"><strong>By Category</strong><span>Security ${escapeHtml(secCount)} · Efficiency ${escapeHtml(effCount)} · Best Practices ${escapeHtml(bpCount)}</span></div>
      </div>
    </div>`;
  }

  // ── Quick Actions ──
  const qa = contract.quickActions;
  let quickActionsSection = "";
  if (qa && qa.length > 0) {
    quickActionsSection = `
    <div class="section">
      <h2 class="section-title">Quick Actions</h2>
      <div class="pill-row">
        ${qa.map((a) => `<span class="pill">⚡ ${escapeHtml(a)}</span>`).join("")}
      </div>
    </div>`;
  }

  // ── Top Findings ──
  const topFindings = [...displayFindings]
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 5);
  if (topFindings.length === 0 && declaredFindings > 0) {
    topFindings.push({
      severity: "INFO",
      message: "Issues were detected. Open the full web report for the complete breakdown.",
    });
  }
  const fallbackMarkup = declaredFindings > 0
    ? `<div class="empty">Issues were detected. Open the full web report for the complete breakdown.</div>`
    : `<div class="empty">No issues found.</div>`;

  return `
    ${decisionSection}
    <div class="section">
      <h2 class="section-title">Dockerfile Report Summary</h2>
      <div class="stack">
        <div class="stack-card"><strong>Security Score</strong><span>${escapeHtml(score)} — Grade ${escapeHtml(secGrade)}</span></div>
        <div class="stack-card"><strong>Production Readiness</strong><span>${escapeHtml(readiness)}${readGrade ? ` — Grade ${escapeHtml(readGrade)}` : ""}</span></div>
        <div class="stack-card"><strong>Engine</strong><span>${escapeHtml(engine)}</span></div>
        <div class="stack-card"><strong>Total Findings</strong><span>${escapeHtml(String(declaredFindings))}</span></div>
        ${severityLine ? `<div class="stack-card"><strong>Severity</strong><span>${escapeHtml(severityLine)}</span></div>` : ""}
      </div>
    </div>
    ${summarySection}
    ${quickActionsSection}
    <div class="section">
      <h2 class="section-title">Top Findings</h2>
      <p class="section-copy">The panel keeps the top 5 findings in view. Open the full report for the complete breakdown.</p>
      <div class="stack">
        ${topFindings.map((item) => {
          const severity = String(item.severity || "INFO").toUpperCase();
          const icon = severity === "CRITICAL" || severity === "HIGH" ? "🔴" : severity === "MEDIUM" ? "🟠" : "🟡";
          return `<div class="stack-card"><strong>${icon} [${escapeHtml(severity)}]</strong><span>${escapeHtml(item.message || item.description || "Untitled finding")}</span></div>`;
        }).join("") || fallbackMarkup}
      </div>
    </div>
    <div class="section">
      <h2 class="section-title">CVE Scan</h2>
      <p class="section-copy">CVE scanning is not executed inside VS Code. Run it manually on the platform to fetch vulnerability IDs, CVSS scores, and fixed versions.</p>
      <div class="pill-row">
        <span class="pill">Status: Not Started</span>
        <a class="pill" href="${webAppUrl}#cve">Run Manual CVE Scan</a>
      </div>
    </div>
    <div class="section">
      <h2 class="section-title">Full Report</h2>
      <p class="section-copy"><a class="pill" href="${webAppUrl}">Open Full Report</a></p>
    </div>
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
  const summary = asRecord(data.summary);
  const fallbackPackages = Array.isArray(data.components) ? data.components.length : Array.isArray(data.packages) ? data.packages.length : 0;
  const vulnerabilityData = asRecord(data.vulnerability_scan);
  const fallbackVulnerabilities = Array.isArray(vulnerabilityData.vulnerabilities)
    ? vulnerabilityData.vulnerabilities.length
    : findings.length;
  const packages = stringValue(summary.total_components) || String(fallbackPackages);
  const vulnerabilities = stringValue(summary.vulnerability_count) || String(fallbackVulnerabilities);
  const vulnerableComponents = stringValue(summary.vulnerable_component_count);
  const licenseReviews = stringValue(summary.license_review_count);
  const disallowed = stringValue(summary.disallowed_count);
  const confidence = stringValue(summary.confidence);
  const riskSignal = stringValue(data.risk_signal) || stringValue(summary.risk_signal);
  const riskLabel = riskSignal ? riskSignal.toUpperCase() : "";

  const topVulnerabilities = Array.isArray(data.top_vulnerabilities) ? data.top_vulnerabilities : [];
  const topVulnerabilityRows = topVulnerabilities
    .map((item) => {
      const row = asRecord(item);
      const pkg = stringValue(row.package) || stringValue(row.name) || "Unknown package";
      const version = stringValue(row.version);
      const severity = stringValue(row.severity) || "UNKNOWN";
      const title = stringValue(row.summary) || stringValue(row.title) || stringValue(row.id) || "Vulnerability";
      const fixedIn = stringValue(row.fixed_in);
      return { pkg, version, severity, title, fixedIn };
    })
    .filter((item) => item.pkg || item.title)
    .slice(0, 5);

  const quickActions = (Array.isArray(data.quick_actions) ? data.quick_actions : [])
    .map((item) => {
      if (!item || typeof item !== "object") {
        return { label: stringValue(item), description: "", severity: "" };
      }
      const row = asRecord(item);
      return {
        label: stringValue(row.label) || stringValue(row.type),
        description: stringValue(row.description) || stringValue(row.target),
        severity: stringValue(row.severity),
      };
    })
    .filter((item) => item.label)
    .slice(0, 5);

  const riskSection = riskLabel
    ? `
    <div class="section">
      <h2 class="section-title">Risk Signal</h2>
      <div class="stack">
        <div class="stack-card"><strong>Overall Risk</strong><span style="color:${severityColor(riskSignal)}">${escapeHtml(riskLabel)}</span></div>
        ${confidence ? `<div class="stack-card"><strong>Confidence</strong><span>${escapeHtml(confidence)}</span></div>` : ""}
        ${licenseReviews ? `<div class="stack-card"><strong>License Review</strong><span>${escapeHtml(licenseReviews)}</span></div>` : ""}
        ${disallowed ? `<div class="stack-card"><strong>Disallowed</strong><span>${escapeHtml(disallowed)}</span></div>` : ""}
      </div>
    </div>`
    : "";

  const topVulnerabilitiesSection = topVulnerabilityRows.length
    ? `
    <div class="section">
      <h2 class="section-title">Top Vulnerabilities</h2>
      <div class="stack">
        ${topVulnerabilityRows.map((item) => {
          const title = `${item.pkg}${item.version ? `@${item.version}` : ""}`;
          const fix = item.fixedIn ? ` Fixed in ${item.fixedIn}.` : "";
          return `<div class="stack-card"><strong>${escapeHtml(item.severity.toUpperCase())} - ${escapeHtml(title)}</strong><span>${escapeHtml(item.title + fix)}</span></div>`;
        }).join("")}
      </div>
    </div>`
    : "";

  const quickActionsSection = quickActions.length
    ? `
    <div class="section">
      <h2 class="section-title">Quick Actions</h2>
      <div class="stack">
        ${quickActions.map((item) => {
          const severity = item.severity ? ` (${item.severity.toUpperCase()})` : "";
          return `<div class="stack-card"><strong>${escapeHtml(item.label + severity)}</strong><span>${escapeHtml(item.description)}</span></div>`;
        }).join("")}
      </div>
    </div>`
    : "";

  return `
    <div class="section">
      <h2 class="section-title">SBOM Snapshot</h2>
      <div class="stack">
        <div class="stack-card"><strong>Components</strong><span>${escapeHtml(String(packages))}</span></div>
        <div class="stack-card"><strong>Vulnerabilities</strong><span>${escapeHtml(String(vulnerabilities))}</span></div>
        ${vulnerableComponents ? `<div class="stack-card"><strong>Vulnerable Components</strong><span>${escapeHtml(vulnerableComponents)}</span></div>` : ""}
      </div>
    </div>
    ${riskSection}
    ${topVulnerabilitiesSection}
    ${quickActionsSection}
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
    return "";
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

function getReportContract(data: Record<string, unknown>): ReportContract {
  const contract = asRecord(data.report_contract);
  const summaryRaw = asRecord(contract.summary);
  const decisionRaw = asRecord(contract.decision_contract);
  const executiveRaw = asRecord(contract.executive_signal);
  const riskRaw = asRecord(contract.risk_posture);
  const statsRaw = asRecord(contract.stats);

  const rawIssues = Array.isArray(contract.detailed_issues) ? contract.detailed_issues : [];
  const detailedIssues: FindingRow[] = rawIssues
    .map((item: unknown) => {
      const row = asRecord(item);
      return {
        ruleId: stringValue(row.rule_id),
        severity: String(row.severity || "INFO").toUpperCase(),
        line: normalizeLine(row.line),
        message: stringValue(row.title) || stringValue(row.description),
        description: stringValue(row.description),
      };
    })
    .filter((item: FindingRow) => item.message || item.description);

  const rawQuickActions = Array.isArray(contract.quick_actions) ? contract.quick_actions : [];

  return {
    securityScore: formatPercent(contract.security_score),
    securityScoreGrade: stringValue(contract.security_score_grade),
    readinessScore: formatPercent(contract.readiness_score),
    readinessGrade: stringValue(contract.production_readiness_grade),
    totalIssues: stringValue(contract.total_issues),
    criticalCount: stringValue(contract.critical_count),
    highCount: stringValue(contract.high_count),
    mediumCount: stringValue(contract.medium_count),
    lowCount: stringValue(contract.low_count),
    detailedIssues: detailedIssues.length ? detailedIssues : undefined,
    summary: Object.keys(summaryRaw).length ? summaryRaw : undefined,
    decisionContract: Object.keys(decisionRaw).length ? decisionRaw : undefined,
    executiveSignal: Object.keys(executiveRaw).length ? executiveRaw : undefined,
    quickActions: rawQuickActions.length
      ? rawQuickActions.map((a: unknown) => String(a || "")).filter(Boolean)
      : undefined,
    riskPosture: Object.keys(riskRaw).length ? riskRaw : undefined,
    stats: Object.keys(statsRaw).length ? statsRaw : undefined,
  };
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

function formatPercent(value: unknown): string {
  const raw = stringValue(value);
  if (!raw) {
    return "";
  }
  const normalized = raw.endsWith("%") ? raw.slice(0, -1) : raw;
  const numeric = Number(normalized.trim());
  if (!Number.isFinite(numeric)) {
    return "";
  }
  return `${Math.round(numeric)}%`;
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

function severityRank(value?: string): number {
  const severity = String(value || "INFO").toUpperCase();
  if (severity === "CRITICAL") return 4;
  if (severity === "HIGH") return 3;
  if (severity === "MEDIUM") return 2;
  if (severity === "LOW") return 1;
  return 0;
}

function displayEngineName(value?: string): string {
  const normalized = String(value || "").trim().toLowerCase();
  if (["", "heuristic", "internal", "ai", "shieldops ai engine"].includes(normalized)) {
    return "ShieldOps AI Engine";
  }
  return String(value || "ShieldOps AI Engine");
}

function buildWebAppUrl(baseUrl: string, task: ShieldOpsTask, payload: ExtensionApiResponse): string {
  const route = stringValue(payload.route);
  if (route) {
    return `${baseUrl}${route}`;
  }
  const result = asRecord(payload.result);
  const scanId = stringValue(result.scan_id);
  if (task === "analyze" && scanId) {
    return `${baseUrl}/analyze/report_view?scan_id=${encodeURIComponent(scanId)}&origin=extension`;
  }
  return `${baseUrl}${String(payload.route || TASK_ROUTE_MAP[task] || "/")}`;
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

function getNonce(): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let text = "";
  for (let i = 0; i < 32; i += 1) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
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
