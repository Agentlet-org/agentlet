/**
 * VS Code UI Adapter - Handle notifications, prompts, and progress
 *
 * Maps Agentlet UI APIs to VS Code's window API.
 */

import * as vscode from "vscode";
import type { IUIHandler } from "../../types/agentlet";

/**
 * Active progress reporter for activity tracking
 */
interface ActiveProgress {
  report: (value: { message?: string; increment?: number }) => void;
  resolve: () => void;
  token: vscode.CancellationToken;
}

/**
 * UI handler implementation for VS Code
 */
export class VSCodeUIHandler implements IUIHandler {
  private activeProgress: ActiveProgress | null = null;
  private panels: Map<string, vscode.WebviewPanel> = new Map();
  private panelIdCounter = 0;

  /**
   * Show a notification (non-blocking)
   */
  async notify(message: string, type?: string): Promise<void> {
    // Don't await - notifications should not block agent execution
    switch (type) {
      case "error":
        vscode.window.showErrorMessage(message);
        break;
      case "warning":
        vscode.window.showWarningMessage(message);
        break;
      case "success":
      case "info":
      default:
        vscode.window.showInformationMessage(message);
        break;
    }
  }

  /**
   * Show a confirmation dialog
   */
  async confirm(message: string): Promise<boolean> {
    const result = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      "Yes",
      "No"
    );
    return result === "Yes";
  }

  /**
   * Show an input prompt
   */
  async prompt(message: string, defaultValue?: string): Promise<string | null> {
    const result = await vscode.window.showInputBox({
      prompt: message,
      value: defaultValue,
    });
    return result ?? null;
  }

  /**
   * Show a form (multi-step quick pick + input boxes)
   */
  async form(config: unknown): Promise<unknown> {
    const c = config as Record<string, unknown>;
    const fields = c.fields as Array<Record<string, unknown>>;
    const results: Record<string, unknown> = {};

    for (const field of fields) {
      const key = field.key as string;
      const label = (field.label as string) || key;
      const type = field.type as string;

      if (type === "select") {
        const options = field.options as Array<{ value: string; label: string }>;
        const items = options.map((o) => ({
          label: o.label,
          description: o.value,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: label,
        });

        if (!selected) {
          throw new Error("Form cancelled");
        }
        results[key] = selected.description;
      } else {
        const value = await vscode.window.showInputBox({
          prompt: label,
          value: field.default as string,
        });

        if (value === undefined) {
          throw new Error("Form cancelled");
        }
        results[key] = value;
      }
    }

    return results;
  }

  /**
   * Show a selection list
   */
  async select(config: unknown): Promise<unknown> {
    const c = config as Record<string, unknown>;
    const options = c.options as Array<{ value: string; label: string; description?: string }>;
    const multi = c.multiple as boolean;
    const title = c.title as string;

    const items = options.map((o) => ({
      label: o.label,
      description: o.description,
      value: o.value,
    }));

    if (multi) {
      const selected = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: title,
      });

      if (!selected) return null;
      return selected.map((s) => (s as unknown as { value: string }).value);
    } else {
      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: title,
      });

      if (!selected) return null;
      return (selected as unknown as { value: string }).value;
    }
  }

  /**
   * Show a panel (WebView)
   */
  async panel(config: unknown): Promise<string> {
    console.log("[Agentlet] Creating panel with config:", JSON.stringify(config, null, 2));

    const c = config as Record<string, unknown>;
    const title = (c.title as string) || "Agent Panel";
    const content = c.content as string;

    console.log("[Agentlet] Panel title:", title);
    console.log("[Agentlet] Panel content length:", content?.length || 0);

    const id = `panel-${++this.panelIdCounter}`;

    const panel = vscode.window.createWebviewPanel(
      "agentlet.panel",
      title,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
      }
    );

    const wrappedContent = this.wrapPanelContent(content);
    console.log("[Agentlet] Wrapped content length:", wrappedContent.length);

    panel.webview.html = wrappedContent;

    panel.onDidDispose(() => {
      this.panels.delete(id);
    });

    this.panels.set(id, panel);
    console.log("[Agentlet] Panel created with id:", id);
    return id;
  }

  /**
   * Update panel content
   */
  async updatePanel(id: string, updates: unknown): Promise<void> {
    const panel = this.panels.get(id);
    if (!panel) {
      throw new Error(`Panel not found: ${id}`);
    }

    const u = updates as Record<string, unknown>;

    if (u.title) {
      panel.title = u.title as string;
    }

    if (u.content) {
      panel.webview.html = this.wrapPanelContent(u.content as string);
    }
  }

  /**
   * Close a panel
   */
  async closePanel(id: string): Promise<void> {
    const panel = this.panels.get(id);
    if (panel) {
      panel.dispose();
      this.panels.delete(id);
    }
  }

  /**
   * Start activity tracking
   */
  async activityStart(message: string): Promise<void> {
    // Complete any existing progress
    if (this.activeProgress) {
      this.activeProgress.resolve();
    }

    // Create new progress
    await new Promise<void>((resolve) => {
      vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: message,
          cancellable: true,
        },
        async (progress, token) => {
          return new Promise<void>((progressResolve) => {
            this.activeProgress = {
              report: progress.report.bind(progress),
              resolve: () => {
                progressResolve();
                this.activeProgress = null;
              },
              token,
            };
            resolve();
          });
        }
      );
    });
  }

  /**
   * Update activity step
   */
  async activityStep(message: string): Promise<void> {
    if (this.activeProgress) {
      this.activeProgress.report({ message });
    }
  }

  /**
   * Update activity progress
   */
  async activityProgress(
    current: number,
    total: number,
    message?: string
  ): Promise<void> {
    if (this.activeProgress) {
      const increment = total > 0 ? (current / total) * 100 : 0;
      this.activeProgress.report({
        message: message || `${current}/${total}`,
        increment,
      });
    }
  }

  /**
   * Log activity message
   */
  async activityLog(message: string, level?: string): Promise<void> {
    // For VS Code, we log to output channel
    const prefix = level ? `[${level.toUpperCase()}] ` : "";
    console.log(`[Agentlet] ${prefix}${message}`);
  }

  /**
   * Complete activity
   */
  async activityComplete(message: string): Promise<void> {
    if (this.activeProgress) {
      this.activeProgress.resolve();
    }
    // Don't await - let the notification show without blocking
    vscode.window.showInformationMessage(message);
  }

  /**
   * Show activity error
   */
  async activityError(message: string): Promise<void> {
    if (this.activeProgress) {
      this.activeProgress.resolve();
    }
    // Don't await - let the error show without blocking
    vscode.window.showErrorMessage(message);
  }

  /**
   * Wrap panel content in basic HTML structure
   */
  private wrapPanelContent(content: string): string {
    // If content already looks like complete HTML, return as-is
    if (content.trim().toLowerCase().startsWith("<!doctype") ||
        content.trim().toLowerCase().startsWith("<html")) {
      return content;
    }

    // Wrap partial content
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 1rem;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;
  }
}
