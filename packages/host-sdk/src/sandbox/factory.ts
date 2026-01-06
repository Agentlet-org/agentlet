/**
 * Sandbox Factory - Create sandboxes based on configuration
 *
 * This factory automatically selects the appropriate sandbox type
 * based on the provided configuration and runtime environment.
 */

import { ISandbox } from "../types";
import { detectTransport } from "../transport";
import { SandboxConfig } from "./types";
import { HeadlessSandbox, createHeadlessSandbox } from "./headless";

// Note: IframeSandbox and ContainerIframeSandbox are dynamically imported
// inside createSandbox() to avoid loading browser-only code in Node.js

/**
 * Create a sandbox based on configuration
 *
 * This factory function automatically selects the appropriate sandbox type:
 * - HeadlessSandbox when windowProvider/documentProvider are provided
 * - IframeSandbox for browser environments
 * - ContainerIframeSandbox when a container element is specified
 *
 * @param config Sandbox configuration
 * @returns Configured sandbox instance
 *
 * @example
 * ```typescript
 * // Browser with default body attachment
 * const sandbox = createSandbox({ permissions: { inference: true } });
 *
 * // Browser with specific container
 * const sandbox = createSandbox({
 *   permissions: { inference: true },
 *   container: document.getElementById('sandbox-container')
 * });
 *
 * // Headless (testing)
 * import { JSDOM } from 'jsdom';
 * const dom = new JSDOM('...');
 * const sandbox = createSandbox({
 *   permissions: { inference: true },
 *   windowProvider: () => dom.window,
 *   documentProvider: () => dom.window.document
 * });
 * ```
 */
export function createSandbox(config: SandboxConfig): ISandbox {
  // Headless sandbox (for testing/CLI)
  if (config.windowProvider && config.documentProvider) {
    return new HeadlessSandbox(config);
  }

  // Browser environment check
  if (typeof document === "undefined") {
    throw new Error(
      "Cannot create DOM sandbox in non-browser environment. " +
        "Provide windowProvider and documentProvider for headless usage."
    );
  }

  // Import sandbox classes dynamically to avoid issues in Node.js
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { IframeSandbox, ContainerIframeSandbox } = require("../sandbox");

  // Container-based sandbox
  if (config.container) {
    let containerElement: HTMLElement;

    if (config.container === "body") {
      containerElement = document.body;
    } else if (config.container === "create") {
      containerElement = document.createElement("div");
      containerElement.style.display = "none";
      document.body.appendChild(containerElement);
    } else {
      containerElement = config.container;
    }

    return new ContainerIframeSandbox(containerElement, config.permissions);
  }

  // Default iframe sandbox
  return new IframeSandbox(config.permissions);
}

/**
 * Re-export HeadlessSandbox utilities
 */
export { HeadlessSandbox, createHeadlessSandbox };
