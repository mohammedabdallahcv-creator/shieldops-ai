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
              return;
            }

            const exportSbomBtn = target.closest("[data-export-sbom-json]");
            if (exportSbomBtn) {
              event.preventDefault();
              if (loading) {
                return;
              }
              setLoading(true, "Exporting SBOM JSON...");
              if (vscode) {
                vscode.postMessage({ command: "exportSbomJson" });
              }
              window.setTimeout(() => setLoading(false), 1200);
              return;
            }

            const printBtn = target.closest("[data-print-report]");
            if (printBtn) {
              event.preventDefault();
              if (loading) {
                return;
              }
              setLoading(true, "Preparing print view...");
              if (vscode) {
                vscode.postMessage({ command: "printReport" });
              }
              window.setTimeout(() => setLoading(false), 1500);
              return;
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

      const toastActions: string[] = task === "sbom"
        ? ["Export JSON"]
        : ["Open in Web App"];

      const choice = await vscode.window.showInformationMessage(
        payload.summary || `ShieldOps AI completed ${TASK_LABELS[task]}.`,
        ...toastActions,
      );

      if (choice === "Open in Web App") {
        const targetRoute = payload.route || TASK_ROUTE_MAP[task];
        await openExternal(baseUrl, targetRoute);
      } else if (choice === "Export JSON" && task === "sbom" && payload.result) {
        const json = buildCycloneDxJson(payload.result);
        const safeName = (fileName || "sbom").replace(/[^a-zA-Z0-9._-]/g, "_");
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(`${safeName}.cdx.json`),
          filters: { "CycloneDX JSON": ["json"], "All files": ["*"] },
          title: "Export SBOM — CycloneDX 1.5",
        });
        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(json, "utf-8"));
          vscode.window.showInformationMessage(`SBOM exported to ${vscode.workspace.asRelativePath(uri)}`);
        }
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
      return;
    }
    if (command === "exportSbomJson" && task === "sbom" && payload.result) {
      const json = buildCycloneDxJson(payload.result);
      const safeName = (fileName || "sbom").replace(/[^a-zA-Z0-9._-]/g, "_");
      const uri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(`${safeName}.cdx.json`),
        filters: { "CycloneDX JSON": ["json"], "All files": ["*"] },
        title: "Export SBOM — CycloneDX 1.5",
      });
      if (uri) {
        await vscode.workspace.fs.writeFile(uri, Buffer.from(json, "utf-8"));
        vscode.window.showInformationMessage(`SBOM exported to ${vscode.workspace.asRelativePath(uri)}`);
      }
      return;
    }
    if (command === "printReport" && task === "sbom" && payload.result) {
      const html = buildSbomPrintHtml(payload.result, fileName);
      const os = await import("os");
      const path = await import("path");
      const fs = await import("fs");
      const tmpFile = path.join(os.tmpdir(), "shieldops-sbom-report.html");
      fs.writeFileSync(tmpFile, html, "utf-8");
      await vscode.env.openExternal(vscode.Uri.file(tmpFile));
      return;
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

// ─────────────────────────────────────────────────────────────────────────────
// DROP-IN REPLACEMENT for renderSbomSection() in src/extension.ts
//
// REPLACES lines 1830–1933 (the entire function, inclusive).
//
// Assumptions — all satisfied by the existing extension.ts:
//   • Helper functions available: asRecord, stringValue, escapeHtml,
//     severityColor, renderFindingsSection
//   • CSS available: v2Styles const (v2-section, v2-metric, v2-hero,
//     v2-finding-card, v2-collapsible, v2-list, v2-copy-btn, shieldops-btn,
//     shieldops-btn-primary, pill, pill-row …)
//   • JS available: renderResultPanelScript() handles data-copy-text,
//     data-toggle-collapse, data-open-report automatically
//   • API response fields from POST /api/ext/run { task:"sbom" }:
//       data.summary.total_components / direct_deps / transitive_deps /
//       vulnerability_count / vulnerable_component_count /
//       license_review_count / disallowed_count / confidence / risk_signal
//       data.risk_signal
//       data.vulnerability_breakdown.{ critical, high, medium, low }
//       data.licenses[].{ name, risky }
//       data.outdated_packages[].{ name, current, latest, major_bump }
//       data.top_vulnerabilities[].{ package/name, version, severity,
//                                    summary/title/id, fixed_in, cvss_score }
//       data.quick_actions[].{ label/type, description/target, severity }
// ─────────────────────────────────────────────────────────────────────────────

function renderSbomSection(
  result: unknown,
  findings: Array<{ severity?: string; line?: string | number; message?: string; description?: string }>,
): string {
  const data    = asRecord(result);
  const summary = asRecord(data.summary);

  // ── 1. Snapshot counts ────────────────────────────────────────────────────
  const fallbackComponents =
    Array.isArray(data.components) ? data.components.length :
    Array.isArray(data.packages)   ? data.packages.length : 0;

  const totalComponents = escapeHtml(stringValue(summary.total_components) || String(fallbackComponents) || "—");
  const directDeps      = escapeHtml(stringValue(summary.direct_deps)      || "—");
  const transitiveDeps  = escapeHtml(stringValue(summary.transitive_deps)  || "—");

  const vulnScan    = asRecord(data.vulnerability_scan);
  const fallbackVulnCount = Array.isArray(vulnScan.vulnerabilities)
    ? vulnScan.vulnerabilities.length
    : findings.length;
  const totalVulns  = Number(stringValue(summary.vulnerability_count) || fallbackVulnCount) || 0;
  const vulnColor   = totalVulns > 0 ? "#ff6b8a" : "#66f0b3";

  // ── 2. Risk signal ────────────────────────────────────────────────────────
  const riskRaw    = (stringValue(data.risk_signal) || stringValue(summary.risk_signal) || "").toUpperCase();
  const confidence = escapeHtml(stringValue(summary.confidence));
  const deployable = riskRaw !== "CRITICAL" && riskRaw !== "HIGH";

  const riskClass =
    riskRaw === "CRITICAL" || riskRaw === "HIGH" ? "high" :
    riskRaw === "MEDIUM" ? "medium" :
    riskRaw === "LOW"    ? "low"    : "neutral";

  const riskCard = riskRaw ? `
    <div class="v2-decision ${riskClass}" style="margin-bottom:16px">
      <div class="v2-decision-label">SUPPLY CHAIN RISK</div>
      <div class="v2-decision-text">
        ${deployable ? "✅" : "🚫"} ${escapeHtml(riskRaw)}
        ${confidence
          ? `<span style="font-size:13px;font-weight:400;color:#9fb0c0"> · Confidence: ${confidence}</span>`
          : ""}
      </div>
    </div>` : "";

  // ── 3. Snapshot 2×2 grid ──────────────────────────────────────────────────
  const snapshotGrid = `
    <div class="v2-hero" style="margin-bottom:16px">
      <div class="v2-metric">
        <div class="v2-metric-label">COMPONENTS</div>
        <div class="v2-metric-value">${totalComponents}</div>
      </div>
      <div class="v2-metric">
        <div class="v2-metric-label">DIRECT DEPS</div>
        <div class="v2-metric-value">${directDeps}</div>
      </div>
    </div>
    <div class="v2-hero" style="margin-bottom:16px">
      <div class="v2-metric">
        <div class="v2-metric-label">TRANSITIVE DEPS</div>
        <div class="v2-metric-value">${transitiveDeps}</div>
      </div>
      <div class="v2-metric">
        <div class="v2-metric-label">VULNERABILITIES</div>
        <div class="v2-metric-value" style="color:${vulnColor}">${totalVulns}</div>
      </div>
    </div>`;

  // ── 4. Vulnerability breakdown bars ───────────────────────────────────────
  const bkd        = asRecord(data.vulnerability_breakdown);
  const bCrit      = Number(bkd.critical ?? 0);
  const bHigh      = Number(bkd.high     ?? 0);
  const bMed       = Number(bkd.medium   ?? 0);
  const bLow       = Number(bkd.low      ?? 0);
  const bTotal     = bCrit + bHigh + bMed + bLow;

  function vulnBar(label: string, count: number, color: string): string {
    const pct = bTotal > 0 ? Math.round((count / bTotal) * 100) : 0;
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span style="width:72px;font-size:10px;font-weight:800;letter-spacing:1px;color:${color}">${label}</span>
        <div style="flex:1;height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:3px"></div>
        </div>
        <span style="width:26px;text-align:right;font-size:13px;font-weight:800;color:#e6edf3">${count}</span>
      </div>`;
  }

  const breakdownSection = bTotal > 0 ? `
    <div class="v2-section" style="margin-bottom:16px">
      <div class="v2-section-title">VULNERABILITY BREAKDOWN</div>
      ${vulnBar("CRITICAL", bCrit, "#ff6b8a")}
      ${vulnBar("HIGH",     bHigh, "#ffb25c")}
      ${vulnBar("MEDIUM",   bMed,  "#ffd36a")}
      ${vulnBar("LOW",      bLow,  "#76d9ff")}
      <div style="margin-top:10px;font-size:11px;color:#606880">
        Total known CVEs: <strong style="color:#e6edf3">${bTotal}</strong>
      </div>
    </div>` : "";

  // ── 5. License compliance ─────────────────────────────────────────────────
  const rawLicenses      = Array.isArray(data.licenses) ? data.licenses : [];
  const licenseReviewCnt = stringValue(summary.license_review_count);
  const disallowedCnt    = stringValue(summary.disallowed_count);

  const licPills = rawLicenses
    .map((item) => {
      const row  = asRecord(item);
      const name = escapeHtml(stringValue(row.name));
      if (!name) { return ""; }
      const risky = Boolean(row.risky) || /^(gpl|agpl)/i.test(stringValue(row.name));
      const style = risky
        ? 'style="color:#f97316;border-color:rgba(249,115,22,0.35);background:rgba(249,115,22,0.08)"'
        : "";
      return `<span class="pill" ${style}>${name}</span>`;
    })
    .filter(Boolean)
    .join("");

  const licenseSection = (licPills || licenseReviewCnt || disallowedCnt) ? `
    <div class="v2-section" style="margin-bottom:16px">
      <div class="v2-section-title">LICENSE COMPLIANCE</div>
      ${licPills ? `<div class="pill-row" style="margin-bottom:10px">${licPills}</div>` : ""}
      ${disallowedCnt && disallowedCnt !== "0"
        ? `<p style="margin:0;font-size:12px;color:#f97316">⚠ ${escapeHtml(disallowedCnt)} disallowed license(s) — review before shipping.</p>`
        : licenseReviewCnt && licenseReviewCnt !== "0"
          ? `<p style="margin:0;font-size:12px;color:#9fb0c0">${escapeHtml(licenseReviewCnt)} license(s) flagged for review.</p>`
          : `<p style="margin:0;font-size:12px;color:#66f0b3">✅ No license conflicts detected.</p>`}
    </div>` : "";

  // ── 6. Outdated packages ──────────────────────────────────────────────────
  const rawOutdated = Array.isArray(data.outdated_packages) ? data.outdated_packages : [];
  const outdatedRows = rawOutdated
    .slice(0, 6)
    .map((item) => {
      const row     = asRecord(item);
      const name    = escapeHtml(stringValue(row.name));
      const current = escapeHtml(stringValue(row.current));
      const latest  = escapeHtml(stringValue(row.latest));
      const major   = Boolean(row.major_bump);
      if (!name) { return ""; }
      return `
        <div class="v2-list-item">
          <span class="v2-list-index" style="font-size:9px;background:rgba(255,255,255,0.04);color:#555e6e">•</span>
          <span class="v2-list-text">
            ${name}
            ${current ? `<span style="color:#606880"> ${current}</span>` : ""}
            ${latest  ? `<span style="color:#66f0b3"> → ${latest}</span>` : ""}
            ${major   ? `<span style="font-size:9px;font-weight:800;color:#f97316;background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);border-radius:4px;padding:1px 5px;margin-left:6px">MAJOR</span>` : ""}
          </span>
        </div>`;
    })
    .filter(Boolean)
    .join("");

  const moreOutdated = rawOutdated.length > 6 ? rawOutdated.length - 6 : 0;

  const outdatedSection = outdatedRows ? `
    <div class="v2-section" style="margin-bottom:16px">
      <div class="v2-section-title">OUTDATED PACKAGES${rawOutdated.length > 0 ? ` — ${rawOutdated.length}` : ""}</div>
      <div class="v2-list">${outdatedRows}</div>
      ${moreOutdated > 0
        ? `<p class="v2-findings-note" style="margin-top:10px">… and ${moreOutdated} more. Open the full report.</p>`
        : ""}
    </div>` : "";

  // ── 7. Top vulnerabilities ────────────────────────────────────────────────
  const topVulns = (Array.isArray(data.top_vulnerabilities) ? data.top_vulnerabilities : [])
    .map((item) => {
      const row = asRecord(item);
      return {
        pkg:      stringValue(row.package)    || stringValue(row.name) || "Unknown",
        version:  stringValue(row.version),
        severity: (stringValue(row.severity)  || "UNKNOWN").toUpperCase(),
        title:    stringValue(row.summary)    || stringValue(row.title) || stringValue(row.id) || "Vulnerability",
        fixedIn:  stringValue(row.fixed_in),
        cveId:    stringValue(row.id)         || stringValue(row.cve_id),
        cvss:     stringValue(row.cvss_score) || stringValue(row.cvss),
      };
    })
    .filter((v) => v.pkg || v.title);

  const vulnCards = topVulns
    .map((v, i) => {
      const sevClass = `v2-severity-${v.severity.toLowerCase()}`;
      const isExtra  = i >= 3 ? " is-extra" : "";
      const fixCmd   = v.fixedIn ? `upgrade ${v.pkg} to ${v.fixedIn}` : "";
      return `
        <div class="v2-finding-card v2-collapsible-item${isExtra}">
          <div class="v2-finding-severity ${sevClass}">${escapeHtml(v.severity)}</div>
          ${v.cveId ? `<div style="font-size:11px;font-weight:700;color:#a78bfa;margin-bottom:4px">${escapeHtml(v.cveId)}</div>` : ""}
          <div class="v2-finding-title">
            ${escapeHtml(v.pkg)}${v.version ? `<span style="color:#606880">@${escapeHtml(v.version)}</span>` : ""}
          </div>
          <div class="v2-finding-desc">${escapeHtml(v.title)}</div>
          ${v.fixedIn
            ? `<div style="margin-top:8px;font-size:11px;color:#66f0b3">
                 ✅ Fix available:
                 <code style="background:rgba(102,240,179,0.1);border:1px solid rgba(102,240,179,0.22);padding:1px 6px;border-radius:4px">${escapeHtml(v.fixedIn)}</code>
               </div>`
            : `<div style="margin-top:6px;font-size:11px;color:#606880">⚠ No fix available yet</div>`}
          ${v.cvss
            ? `<div style="display:inline-block;margin-top:8px;font-size:10px;font-weight:800;letter-spacing:1px;color:#a78bfa;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.22);border-radius:4px;padding:2px 8px">CVSS ${escapeHtml(v.cvss)}</div>`
            : ""}
          ${fixCmd
            ? `<div style="margin-top:10px">
                 <button class="v2-copy-btn" data-copy-text="${escapeHtml(fixCmd)}">Copy Fix</button>
               </div>`
            : ""}
        </div>`;
    })
    .join("");

  const vulnsSection = topVulns.length ? `
    <div class="v2-section" style="margin-bottom:16px">
      <div class="v2-section-header">
        <div class="v2-section-title">TOP VULNERABILITIES</div>
        ${topVulns.length > 3 ? `
          <div class="v2-section-actions">
            <button class="v2-collapse-btn" data-toggle-collapse="sbom-vulns" aria-expanded="false">
              Show All
            </button>
          </div>` : ""}
      </div>
      <p class="v2-findings-note">
        Showing ${Math.min(3, topVulns.length)} of ${topVulns.length} findings.
        Open the full report for the complete breakdown.
      </p>
      <div class="v2-findings v2-collapsible" data-collapsed="true" data-collapse-id="sbom-vulns">
        ${vulnCards}
      </div>
    </div>` : "";

  // ── 8. Quick actions ──────────────────────────────────────────────────────
  const quickActions = (Array.isArray(data.quick_actions) ? data.quick_actions : [])
    .map((item) => {
      if (!item || typeof item !== "object") {
        return { label: stringValue(item), description: "", severity: "" };
      }
      const row = asRecord(item);
      return {
        label:       stringValue(row.label)       || stringValue(row.type),
        description: stringValue(row.description) || stringValue(row.target),
        severity:    stringValue(row.severity),
      };
    })
    .filter((a) => a.label)
    .slice(0, 5);

  const actionsSection = quickActions.length ? `
    <div class="v2-section" style="margin-bottom:16px">
      <div class="v2-section-title">QUICK ACTIONS</div>
      <div class="v2-list">
        ${quickActions.map((a, i) => `
          <div class="v2-list-item">
            <span class="v2-list-index">${i + 1}</span>
            <span class="v2-list-text">
              ${escapeHtml(a.label)}
              ${a.severity
                ? `<span style="font-size:11px;color:${severityColor(a.severity)};margin-left:4px">(${escapeHtml(a.severity.toUpperCase())})</span>`
                : ""}
              ${a.description
                ? `<div style="color:#606880;font-size:12px;margin-top:3px">${escapeHtml(a.description)}</div>`
                : ""}
            </span>
            ${a.description
              ? `<button class="v2-copy-btn" data-copy-text="${escapeHtml(a.description)}">Copy</button>`
              : ""}
          </div>`).join("")}
      </div>
    </div>` : "";

  // ── 9. Component Inventory ────────────────────────────────────────────────
  const rawComponents = Array.isArray(data.components) ? data.components : [];
  const COMP_VISIBLE = 8;
  const compRows = rawComponents.map((item: unknown, i: number) => {
    const row = asRecord(item);
    const name = escapeHtml(stringValue(row.name) || "—");
    const version = escapeHtml(stringValue(row.version) || "—");
    const type = escapeHtml(stringValue(row.type) || "library");
    const license = stringValue(row.license);
    const licenseDisplay = license && license.toUpperCase() !== "UNKNOWN"
      ? escapeHtml(license)
      : `<span style="color:#606880">—</span>`;
    const isVulnerable = Boolean(row.vulnerable);
    const isDisallowed = Boolean(row.disallowed);
    const riskBadge = isDisallowed
      ? `<span style="font-size:9px;font-weight:800;color:#ff6b8a;background:rgba(255,107,138,0.12);border:1px solid rgba(255,107,138,0.3);border-radius:4px;padding:1px 5px">BLOCKED</span>`
      : isVulnerable
        ? `<span style="font-size:9px;font-weight:800;color:#ffb25c;background:rgba(255,178,92,0.12);border:1px solid rgba(255,178,92,0.3);border-radius:4px;padding:1px 5px">VULN</span>`
        : "";
    const isExtra = i >= COMP_VISIBLE ? " is-extra" : "";
    return `
      <tr class="v2-collapsible-item${isExtra}">
        <td style="color:#e6edf3;font-weight:600">${name}</td>
        <td><code style="font-size:11px;color:#a78bfa">${version}</code></td>
        <td style="color:#606880;font-size:11px">${type}</td>
        <td style="font-size:11px">${licenseDisplay}</td>
        <td>${riskBadge}</td>
      </tr>`;
  }).join("");

  const componentSection = rawComponents.length > 0 ? `
    <div class="v2-section" style="margin-bottom:16px">
      <div class="v2-section-header">
        <div class="v2-section-title">COMPONENT INVENTORY — ${rawComponents.length}</div>
        ${rawComponents.length > COMP_VISIBLE ? `
          <div class="v2-section-actions">
            <button class="v2-collapse-btn" data-toggle-collapse="sbom-components" aria-expanded="false">
              Show All
            </button>
          </div>` : ""}
      </div>
      <div class="v2-collapsible" data-collapsed="true" data-collapse-id="sbom-components">
        <table style="width:100%;border-collapse:collapse;margin-top:8px">
          <thead>
            <tr>
              <th style="text-align:left;color:#606880;font-size:10px;font-weight:800;letter-spacing:1px;padding:6px 10px;border-bottom:1px solid #1e1e2e">NAME</th>
              <th style="text-align:left;color:#606880;font-size:10px;font-weight:800;letter-spacing:1px;padding:6px 10px;border-bottom:1px solid #1e1e2e">VERSION</th>
              <th style="text-align:left;color:#606880;font-size:10px;font-weight:800;letter-spacing:1px;padding:6px 10px;border-bottom:1px solid #1e1e2e">TYPE</th>
              <th style="text-align:left;color:#606880;font-size:10px;font-weight:800;letter-spacing:1px;padding:6px 10px;border-bottom:1px solid #1e1e2e">LICENSE</th>
              <th style="text-align:left;color:#606880;font-size:10px;font-weight:800;letter-spacing:1px;padding:6px 10px;border-bottom:1px solid #1e1e2e"></th>
            </tr>
          </thead>
          <tbody>${compRows}</tbody>
        </table>
      </div>
    </div>` : "";

  // ── 10. Fallback findings table ──────────────────────────────────────────
  const fallbackFindings = renderFindingsSection(findings);

  // ── 11. Export actions ───────────────────────────────────────────────────
  const exportSection = `
    <div class="v2-section" style="margin-bottom:16px">
      <div class="v2-section-title">EXPORT</div>
      <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap">
        <button class="shieldops-btn shieldops-btn-primary"
                data-export-sbom-json
                data-disable-on-loading
                style="flex:1;min-width:180px">
          📦 Export SBOM JSON
        </button>
        <button class="shieldops-btn"
                data-print-report
                style="flex:1;min-width:180px;background:#1e1e2e;color:#d8def0;border:1px solid #2a2a3e">
          🖨️ Print / Save PDF
        </button>
      </div>
      <p style="margin:10px 0 0;font-size:11px;color:#606880">
        CycloneDX 1.5 format · Compatible with Dependency-Track, Grype, OWASP tools
      </p>
    </div>`;

  // ── Assemble ──────────────────────────────────────────────────────────────
  return `
    <div class="shieldops-v2">
      ${riskCard}
      ${snapshotGrid}
      ${breakdownSection}
      ${componentSection}
      ${licenseSection}
      ${outdatedSection}
      ${vulnsSection}
      ${actionsSection}
      ${fallbackFindings}
      ${exportSection}
    </div>`;
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

function buildCycloneDxJson(result: unknown): string {
  const data = asRecord(result);
  const rawComponents = Array.isArray(data.components) ? data.components : [];
  const metadata = asRecord(data.metadata);

  const cdxComponents = rawComponents.map((item: unknown) => {
    const comp = asRecord(item);
    const rawType = stringValue(comp.type);
    const entry: Record<string, unknown> = {
      type: rawType === "container-image" ? "container" : "library",
      name: stringValue(comp.name) || "unknown",
    };
    const version = stringValue(comp.version);
    if (version) { entry.version = version; }
    const purl = stringValue(comp.purl);
    if (purl) { entry.purl = purl; }
    const license = stringValue(comp.license);
    if (license && license.toUpperCase() !== "UNKNOWN") {
      entry.licenses = [{ license: { id: license } }];
    }
    return entry;
  });

  const document = {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: stringValue(data.serial_number) || `urn:uuid:${Date.now().toString(36)}`,
    version: 1,
    metadata: {
      timestamp: stringValue(metadata.timestamp) || new Date().toISOString(),
      tools: [{
        vendor: "ShieldOps AI",
        name: "SBOM Service",
        version: "1.0",
      }],
      component: {
        type: "application",
        name: stringValue(metadata.source_file) || "shieldops-ai-input",
        version: "1.0",
      },
    },
    components: cdxComponents,
  };

  return JSON.stringify(document, null, 2);
}

function buildSbomPrintHtml(result: unknown, fileName: string): string {
  const data = asRecord(result);
  const summary = asRecord(data.summary);
  const metadata = asRecord(data.metadata);
  const components = Array.isArray(data.components) ? data.components : [];
  const riskSignal = (stringValue(data.risk_signal) || stringValue(summary.risk_signal) || "N/A").toUpperCase();
  const confidence = stringValue(summary.confidence) || "—";
  const totalComponents = stringValue(summary.total_components) || String(components.length);
  const vulnCount = stringValue(summary.vulnerability_count) || "0";
  const licenseReview = stringValue(summary.license_review_count) || "0";
  const engine = stringValue(summary.engine) || stringValue(data.engine) || "sbom-lite";
  const timestamp = stringValue(metadata.timestamp) || new Date().toISOString();
  const sourceFile = escapeHtml(stringValue(metadata.source_file) || fileName || "—");

  const compRows = components.map((item: unknown) => {
    const row = asRecord(item);
    const name = escapeHtml(stringValue(row.name) || "—");
    const version = escapeHtml(stringValue(row.version) || "—");
    const type = escapeHtml(stringValue(row.type) || "library");
    const license = escapeHtml(stringValue(row.license) || "—");
    const flags: string[] = [];
    if (row.vulnerable) { flags.push("VULN"); }
    if (row.disallowed) { flags.push("BLOCKED"); }
    return `<tr><td>${name}</td><td>${version}</td><td>${type}</td><td>${license}</td><td>${flags.join(", ")}</td></tr>`;
  }).join("");

  const quickActions = (Array.isArray(data.quick_actions) ? data.quick_actions : [])
    .map((item: unknown) => {
      const row = asRecord(item);
      const label = escapeHtml(stringValue(row.label) || stringValue(row.type) || "");
      const desc = escapeHtml(stringValue(row.description) || "");
      return label ? `<li><strong>${label}</strong>${desc ? ` — ${desc}` : ""}</li>` : "";
    })
    .filter(Boolean)
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>ShieldOps AI — SBOM Report</title>
  <style>
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    body { margin: 0; padding: 32px; font-family: -apple-system, "Segoe UI", Roboto, sans-serif; color: #1a1a2e; background: #fff; line-height: 1.6; }
    .header { border-bottom: 3px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { margin: 0; font-size: 22px; color: #7c3aed; }
    .header p { margin: 4px 0 0; color: #666; font-size: 12px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .card { padding: 14px; border: 1px solid #e5e7eb; border-radius: 8px; }
    .card .label { font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #888; text-transform: uppercase; margin-bottom: 4px; }
    .card .value { font-size: 20px; font-weight: 700; color: #1a1a2e; }
    h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #7c3aed; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin: 24px 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; font-size: 10px; font-weight: 700; letter-spacing: 1px; color: #888; text-transform: uppercase; padding: 6px 8px; border-bottom: 2px solid #e5e7eb; }
    td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; }
    tr:nth-child(even) td { background: #fafafa; }
    .risk-badge { display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: 700; font-size: 13px; }
    .risk-low { background: #ecfdf5; color: #065f46; }
    .risk-medium { background: #fffbeb; color: #92400e; }
    .risk-high, .risk-critical { background: #fef2f2; color: #991b1b; }
    ul { padding-left: 20px; }
    li { margin-bottom: 6px; font-size: 13px; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>ShieldOps AI — SBOM Report</h1>
    <p>Source: ${sourceFile} · Engine: ${escapeHtml(engine)} · Generated: ${escapeHtml(timestamp)}</p>
  </div>

  <div class="grid">
    <div class="card"><div class="label">Supply Chain Risk</div><div class="value"><span class="risk-badge risk-${riskSignal.toLowerCase()}">${escapeHtml(riskSignal)}</span></div></div>
    <div class="card"><div class="label">Confidence</div><div class="value">${escapeHtml(confidence)}</div></div>
    <div class="card"><div class="label">Components</div><div class="value">${escapeHtml(totalComponents)}</div></div>
    <div class="card"><div class="label">Vulnerabilities</div><div class="value">${escapeHtml(vulnCount)}</div></div>
    <div class="card"><div class="label">License Issues</div><div class="value">${escapeHtml(licenseReview)}</div></div>
  </div>

  <h2>Component Inventory (${components.length})</h2>
  <table>
    <thead><tr><th>Name</th><th>Version</th><th>Type</th><th>License</th><th>Flags</th></tr></thead>
    <tbody>${compRows || "<tr><td colspan='5' style='text-align:center;color:#888'>No components detected</td></tr>"}</tbody>
  </table>

  ${quickActions ? `<h2>Recommended Actions</h2><ul>${quickActions}</ul>` : ""}

  <div class="footer">
    ShieldOps AI · CycloneDX 1.5 Lite · Use Ctrl+P / Cmd+P to save as PDF
  </div>
</body>
</html>`;
}

export function deactivate() {}
