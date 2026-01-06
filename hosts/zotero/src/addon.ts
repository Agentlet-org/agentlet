import { config } from "../package.json";
import hooks from "./hooks";
import { createZToolkit } from "./utils/ztoolkit";

class Addon {
  public data: {
    alive: boolean;
    config: typeof config;
    env: "development" | "production";
    initialized?: boolean;
    ztoolkit: ZToolkit;
    locale?: {
      current: any;
    };
    // Plugin info from bootstrap
    id?: string;
    version?: string;
    rootURI?: string;
    // Agent manager state
    agents: {
      installed: Map<string, Agentlet.InstalledAgent>;
      running: Map<string, { agentId: string; actionId: string; startTime: number }>;
    };
    // Database connection
    db?: any;
  };

  // Lifecycle hooks
  public hooks: typeof hooks;

  // Public APIs for other plugins
  public api: {
    installAgent: (url: string) => Promise<Agentlet.InstalledAgent>;
    uninstallAgent: (id: string) => Promise<void>;
    listAgents: () => Agentlet.InstalledAgent[];
    runAgent: (agentId: string, actionId: string, input?: any) => Promise<any>;
  };

  constructor() {
    this.data = {
      alive: true,
      config,
      env: __env__,
      initialized: false,
      ztoolkit: createZToolkit(),
      agents: {
        installed: new Map(),
        running: new Map(),
      },
    };
    this.hooks = hooks;
    this.api = {
      installAgent: async (url: string) => {
        const { AgentManager } = await import("./modules/agent-manager");
        return AgentManager.install(url);
      },
      uninstallAgent: async (id: string) => {
        const { AgentManager } = await import("./modules/agent-manager");
        return AgentManager.uninstall(id);
      },
      listAgents: () => {
        return Array.from(this.data.agents.installed.values());
      },
      runAgent: async (agentId: string, actionId: string, input?: any) => {
        const { AgentRuntime } = await import("./modules/agent-runtime");
        return AgentRuntime.invoke(agentId, actionId, input);
      },
    };
  }

  /**
   * Set plugin info from bootstrap.js
   */
  public setInfo(info: { id: string; version: string; rootURI: string }): void {
    this.data.id = info.id;
    this.data.version = info.version;
    this.data.rootURI = info.rootURI;
  }
}

export default Addon;
