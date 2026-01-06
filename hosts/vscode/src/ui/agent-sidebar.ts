/**
 * Agent Sidebar - TreeDataProvider for the Agentlet view
 *
 * Shows installed agents and their available actions
 */

import * as vscode from "vscode";
import type { AgentManager } from "../modules/agent-manager";
import type { InstalledAgent, AgentActionMeta } from "../types/agentlet";

/**
 * Tree item representing an agent or action
 */
export class AgentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly agent?: InstalledAgent,
    public readonly action?: AgentActionMeta
  ) {
    super(label, collapsibleState);

    if (agent && !action) {
      // Agent item
      this.contextValue = "agent";
      this.iconPath = new vscode.ThemeIcon("robot");
      this.tooltip = this.buildAgentTooltip(agent);
      this.description = agent.manifest.version;
    } else if (agent && action) {
      // Action item
      this.contextValue = "action";
      this.iconPath = new vscode.ThemeIcon("play");
      this.tooltip = action.description || `Run ${action.label || action.id}`;
      this.command = {
        command: "agentlet.runAction",
        title: "Run Action",
        arguments: [agent.id, action.id],
      };
    }
  }

  private buildAgentTooltip(agent: InstalledAgent): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**${agent.manifest.name}** v${agent.manifest.version}\n\n`);

    if (agent.manifest.description) {
      md.appendMarkdown(`${agent.manifest.description}\n\n`);
    }

    md.appendMarkdown(`**Portability:** ${agent.manifest.portability || "unknown"}\n\n`);

    if (agent.manifest.actions.length > 0) {
      md.appendMarkdown(
        `**Actions:** ${agent.manifest.actions.map((a) => a.label || a.id).join(", ")}\n\n`
      );
    }

    md.appendMarkdown(`*Installed: ${new Date(agent.installedAt).toLocaleDateString()}*`);

    return md;
  }
}

/**
 * TreeDataProvider for the agent sidebar
 */
export class AgentTreeDataProvider
  implements vscode.TreeDataProvider<AgentTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    AgentTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private agentManager: AgentManager) {}

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AgentTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AgentTreeItem): Promise<AgentTreeItem[]> {
    if (!element) {
      // Root level - show agents
      await this.agentManager.ensureLoaded();
      const agents = this.agentManager.listAgents();

      if (agents.length === 0) {
        return [
          new AgentTreeItem(
            "No agents installed",
            vscode.TreeItemCollapsibleState.None
          ),
        ];
      }

      return agents.map(
        (agent) =>
          new AgentTreeItem(
            agent.manifest.name,
            agent.manifest.actions.length > 0
              ? vscode.TreeItemCollapsibleState.Collapsed
              : vscode.TreeItemCollapsibleState.None,
            agent
          )
      );
    }

    if (element.agent && !element.action) {
      // Agent level - show actions
      return element.agent.manifest.actions.map(
        (action) =>
          new AgentTreeItem(
            action.label || action.id,
            vscode.TreeItemCollapsibleState.None,
            element.agent,
            action
          )
      );
    }

    return [];
  }

  getParent(element: AgentTreeItem): vscode.ProviderResult<AgentTreeItem> {
    // Actions have agents as parents
    if (element.action && element.agent) {
      return new AgentTreeItem(
        element.agent.manifest.name,
        vscode.TreeItemCollapsibleState.Collapsed,
        element.agent
      );
    }
    return null;
  }
}
