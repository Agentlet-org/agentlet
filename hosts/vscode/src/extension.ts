/**
 * VS Code Agentlet Extension - Main entry point
 *
 * Implements the Agentlet v0.1 specification for VS Code,
 * enabling portable AI agents to run within the editor.
 */

import * as vscode from "vscode";
import { AgentManager } from "./modules/agent-manager";
import { AgentRuntime } from "./modules/agent-runtime";
import { VSCodeStorageAdapter } from "./modules/adapters/storage";
import { VSCodeInferenceProvider } from "./modules/adapters/inference";
import { AgentTreeDataProvider } from "./ui/agent-sidebar";
import type { InstalledAgent } from "./types/agentlet";

// Global instances accessible across the extension
let extensionContext: vscode.ExtensionContext;
let agentManager: AgentManager;
let storageAdapter: VSCodeStorageAdapter;
let inferenceProvider: VSCodeInferenceProvider;
let treeDataProvider: AgentTreeDataProvider;
let activeRuntime: AgentRuntime | null = null;

/**
 * Extension activation point
 */
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  console.log("===========================================");
  console.log("[Agentlet] Activating extension v0.1.0...");
  console.log("===========================================");

  // Store context for runtime creation
  extensionContext = context;

  // Initialize core components
  agentManager = new AgentManager(context);
  storageAdapter = new VSCodeStorageAdapter(context);
  inferenceProvider = new VSCodeInferenceProvider();

  // Load installed agents
  await agentManager.ensureLoaded();

  // Initialize sidebar
  treeDataProvider = new AgentTreeDataProvider(agentManager);
  const treeView = vscode.window.createTreeView("agentlet.agents", {
    treeDataProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Register commands
  registerCommands(context);

  // Register agent action commands
  registerAgentCommands(context);

  // Refresh tree when agents change
  context.subscriptions.push(
    agentManager.onChange(() => {
      treeDataProvider.refresh();
      registerAgentCommands(context);
    })
  );

  console.log("[Agentlet] Extension activated");
}

/**
 * Extension deactivation point
 */
export function deactivate(): void {
  console.log("[Agentlet] Extension deactivated");
}

/**
 * Register core extension commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // Install agent from URL
  context.subscriptions.push(
    vscode.commands.registerCommand("agentlet.installFromUrl", async () => {
      const url = await vscode.window.showInputBox({
        prompt: "Enter agent URL",
        placeHolder: "https://example.com/my-agent.agentlet",
        validateInput: (value) => {
          if (!value) return "URL is required";
          try {
            new URL(value);
            return null;
          } catch {
            return "Invalid URL";
          }
        },
      });

      if (url) {
        await installAgent(url);
      }
    })
  );

  // Refresh agents
  context.subscriptions.push(
    vscode.commands.registerCommand("agentlet.refreshAgents", () => {
      treeDataProvider.refresh();
    })
  );

  // Uninstall agent
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "agentlet.uninstall",
      async (item: AgentTreeItem) => {
        if (!item || !item.agent) {
          vscode.window.showErrorMessage("No agent selected");
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Uninstall "${item.agent.manifest.name}"?`,
          { modal: true },
          "Uninstall"
        );

        if (confirm === "Uninstall") {
          await agentManager.uninstallAgent(item.agent.id);
          vscode.window.showInformationMessage(
            `Uninstalled: ${item.agent.manifest.name}`
          );
        }
      }
    )
  );

  // View agent source
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "agentlet.viewSource",
      async (item: AgentTreeItem) => {
        if (!item || !item.agent) {
          vscode.window.showErrorMessage("No agent selected");
          return;
        }

        const doc = await vscode.workspace.openTextDocument({
          content: item.agent.html,
          language: "html",
        });
        await vscode.window.showTextDocument(doc);
      }
    )
  );

  // Run agent action (triggered from tree view)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "agentlet.runAction",
      async (agentId: string, actionId: string) => {
        await executeAgentAction(agentId, actionId);
      }
    )
  );
}

/**
 * Register commands for each agent action
 */
function registerAgentCommands(context: vscode.ExtensionContext): void {
  for (const agent of agentManager.listAgents()) {
    for (const action of agent.manifest.actions) {
      const commandId = `agentlet.action.${agent.id}.${action.id}`;

      // Check if command already registered
      const existing = context.subscriptions.find(
        (sub) => (sub as any).commandId === commandId
      );
      if (existing) continue;

      const disposable = vscode.commands.registerCommand(commandId, () =>
        executeAgentAction(agent.id, action.id)
      );

      // Tag disposable with command ID for later lookup
      (disposable as any).commandId = commandId;
      context.subscriptions.push(disposable);
    }
  }
}

/**
 * Install an agent from URL
 */
async function installAgent(url: string): Promise<void> {
  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Installing agent...",
        cancellable: false,
      },
      async () => {
        const agent = await agentManager.installFromUrl(url);
        vscode.window.showInformationMessage(
          `Installed: ${agent.manifest.name}`
        );
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    vscode.window.showErrorMessage(`Failed to install: ${message}`);
    console.error("[Agentlet] Install error:", error);
  }
}

/**
 * Execute an agent action
 */
async function executeAgentAction(
  agentId: string,
  actionId: string
): Promise<void> {
  const agent = agentManager.getAgent(agentId);
  if (!agent) {
    vscode.window.showErrorMessage("Agent not found");
    return;
  }

  const action = agent.manifest.actions.find((a) => a.id === actionId);
  const actionLabel = action?.label || actionId;

  // Cancel any running action
  if (activeRuntime) {
    activeRuntime.cancel();
    activeRuntime.destroy();
    activeRuntime = null;
  }

  // Create runtime for this execution
  const runtime = new AgentRuntime(
    extensionContext,
    agent,
    storageAdapter,
    inferenceProvider
  );
  activeRuntime = runtime;

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `Running: ${agent.manifest.name} - ${actionLabel}`,
        cancellable: true,
      },
      async (progress, token) => {
        // Handle cancellation
        token.onCancellationRequested(() => {
          runtime.cancel();
        });

        // Execute action
        return await runtime.executeAction(actionId);
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    vscode.window.showErrorMessage(`Error: ${message}`);
    console.error("[Agentlet] Action error:", error);
  } finally {
    // Clean up runtime
    runtime.destroy();
    if (activeRuntime === runtime) {
      activeRuntime = null;
    }
  }
}

/**
 * Tree item interface for type checking
 */
interface AgentTreeItem extends vscode.TreeItem {
  agent?: InstalledAgent;
  action?: { id: string; label?: string };
}
