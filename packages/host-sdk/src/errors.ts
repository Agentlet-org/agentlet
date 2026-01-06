/**
 * Standard error codes from the Agentlet v0.1 specification
 *
 * Error code ranges:
 * - E1xx: Permission errors
 * - E2xx: Context errors
 * - E3xx: Inference errors
 * - E4xx: Network errors
 * - E5xx: Resource limit errors
 * - E6xx: Agent errors
 * - E7xx: User errors
 * - E8xx: Host errors
 * - E9xx: MCP errors
 * - E10xx: Adaptive agent errors
 */
export const ErrorCodes = {
  // Permission errors (E1xx)
  PERMISSION_DENIED: "E101",
  CAPABILITY_NOT_GRANTED: "E102",

  // Context errors (E2xx)
  CONTEXT_NOT_FOUND: "E201",
  CONTEXT_TYPE_UNSUPPORTED: "E202",
  CONTEXT_VALIDATION_FAILED: "E203",
  CONTEXT_CONFLICT: "E204",

  // Inference errors (E3xx)
  INFERENCE_FAILED: "E301",
  INFERENCE_TIMEOUT: "E302",
  INFERENCE_RATE_LIMITED: "E303",
  INFERENCE_UNAVAILABLE: "E304",
  INFERENCE_INVALID_RESPONSE: "E305",

  // Network errors (E4xx)
  NETWORK_ERROR: "E401",
  NETWORK_TIMEOUT: "E402",
  NETWORK_DOMAIN_NOT_ALLOWED: "E403",
  NETWORK_RATE_LIMITED: "E404",

  // Resource limit errors (E5xx)
  LIMIT_TIME_EXCEEDED: "E501",
  LIMIT_INFERENCE_EXCEEDED: "E502",
  LIMIT_NETWORK_EXCEEDED: "E503",
  LIMIT_STORAGE_EXCEEDED: "E504",

  // Agent errors (E6xx)
  AGENT_INVALID: "E601",
  AGENT_ACTION_NOT_FOUND: "E602",
  AGENT_HANDLER_ERROR: "E603",

  // User errors (E7xx)
  USER_CANCELLED: "E701",
  USER_DISMISSED: "E702",

  // Host errors (E8xx)
  HOST_UNSUPPORTED: "E801",
  HOST_ERROR: "E802",
  SPEC_VERSION_TOO_LOW: "E804",
  SPEC_VERSION_TOO_HIGH: "E805",
  FEATURE_NOT_SUPPORTED: "E806",

  // MCP errors (E9xx)
  MCP_SERVER_NOT_FOUND: "E901",
  MCP_CONNECTION_FAILED: "E902",
  MCP_TOOL_NOT_FOUND: "E903",

  // Adaptive agent errors (E10xx)
  INTENT_NOT_SUPPORTED: "E1001",
  PERCEIVE_FAILED: "E1002",
  ACT_FAILED: "E1003",

  // Internal error
  NOT_IMPLEMENTED: "E999",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

/**
 * Standard error class for Agentlet errors
 */
export class AgentletError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AgentletError";
    this.code = code;
    this.details = details;
  }
}
