/**
 * Agentlet Language Extension for VS Code
 *
 * Provides syntax highlighting and snippets for .agentlet files.
 * This is a language-only extension - the runtime host is at hosts/vscode/.
 */

import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  console.log("Agentlet Language Support activated");

  // Register file association
  const config = vscode.workspace.getConfiguration();
  const associations = config.get<Record<string, string>>("files.associations") || {};

  if (!associations["*.agentlet"]) {
    // Suggest adding file association
    vscode.window
      .showInformationMessage(
        "Associate .agentlet files with Agentlet language?",
        "Yes",
        "No"
      )
      .then((selection) => {
        if (selection === "Yes") {
          config.update(
            "files.associations",
            { ...associations, "*.agentlet": "agentlet" },
            vscode.ConfigurationTarget.Global
          );
        }
      });
  }
}

export function deactivate(): void {
  // Clean up if needed
}
