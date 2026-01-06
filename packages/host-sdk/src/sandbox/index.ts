/**
 * Sandbox module - Agent execution environments
 *
 * Use createSandbox() to create the appropriate sandbox type:
 * - Browser with container: ContainerIframeSandbox (automatic)
 * - Browser without container: IframeSandbox (automatic)
 * - Node.js with jsdom: HeadlessSandbox
 */

export { SandboxConfig, SandboxFactory } from "./types";
export { createSandbox, HeadlessSandbox, createHeadlessSandbox } from "./factory";
