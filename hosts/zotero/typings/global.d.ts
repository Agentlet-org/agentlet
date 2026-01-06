declare const _globalThis: {
  [key: string]: any;
  Zotero: _ZoteroTypes.Zotero;
  ztoolkit: ZToolkit;
  addon: typeof addon;
};

declare type ZToolkit = ReturnType<
  typeof import("../src/utils/ztoolkit").createZToolkit
>;

declare const ztoolkit: ZToolkit;
declare const rootURI: string;
declare const addon: import("../src/addon").default;
declare const __env__: "production" | "development";

// Agentlet-specific types
declare namespace Agentlet {
  interface Manifest {
    manifest_version: string;
    name: string;
    version: string;
    description?: string;
    author?: string | { name: string; url?: string; email?: string };
    license?: string;
    homepage?: string;
    icon?: string;
    engines?: {
      agentlet?: string;
      hosts?: Record<string, string>;
    };
    capabilities: {
      context?: string[];
      network?: string[];
      inference?: string;
      storage?: boolean;
      ui?: {
        notify?: boolean;
        confirm?: boolean;
        prompt?: boolean;
        form?: boolean;
        select?: boolean;
        panel?: { position?: string; width?: number };
        chat?: boolean;
      };
      observability?: {
        activity?: boolean;
        trace?: boolean;
      };
      mcp?: {
        required?: string[];
        optional?: string[];
        discover?: boolean;
      };
    };
    limits?: {
      maxExecutionTime?: number;
      maxInferenceCalls?: number;
      maxNetworkRequests?: number;
      maxStorageBytes?: number;
    };
    preferences?: Record<string, PreferenceDefinition>;
    actions: Record<string, ActionDefinition>;
    triggers?: Record<string, TriggerDefinition>;
  }

  interface PreferenceDefinition {
    type: "string" | "number" | "boolean" | "select" | "multiselect";
    label: string;
    description?: string;
    default?: any;
    options?: Array<{ value: string; label: string }>;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    maxLength?: number;
    pattern?: string;
  }

  interface ActionDefinition {
    description: string;
    input?: string;
    output?: string;
    confirm?: boolean;
    showActivity?: boolean;
  }

  interface TriggerDefinition {
    action: string;
    auto?: boolean;
    preference?: string;
  }

  // Note: InstalledAgent is now defined in src/modules/agent-manager.ts
  // with proper ParsedPermissions type from permission-handler.ts

  interface ManifestCapabilities {
    context?: string[];
    network?: string[];
    inference?: string | boolean;
    storage?: boolean;
    ui?: {
      notify?: boolean;
      confirm?: boolean;
      prompt?: boolean;
      form?: boolean;
      select?: boolean;
      panel?: { position?: string; width?: number } | boolean;
      chat?: boolean;
    };
    observability?: {
      activity?: boolean;
      trace?: boolean;
    };
    mcp?: {
      required?: string[];
      optional?: string[];
      discover?: boolean;
    };
  }

  interface BridgeRequest {
    id: string;
    type: string;
    payload: any;
  }

  interface BridgeResponse {
    id: string;
    success: boolean;
    result?: any;
    error?: {
      code: string;
      message: string;
      details?: any;
    };
  }
}
