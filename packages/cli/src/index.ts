/**
 * @agentlet/cli - Command-line interface for Agentlet development
 *
 * Commands:
 * - create: Scaffold new agent projects
 * - validate: Validate agent manifest
 * - serve: Development server
 * - test: Run agent tests
 *
 * @packageDocumentation
 */

import { Command } from "commander";
import chalk from "chalk";
import * as fs from "node:fs";
import * as path from "node:path";

import { validateAgent, formatValidationResult } from "./commands/validate.js";
import { createAgent, getTemplateNames, getTemplateDescription, TemplateType } from "./commands/create.js";
import { serveAgent } from "./commands/serve.js";
import { testAgent, formatTestResult } from "./commands/test.js";

const program = new Command();

program
  .name("agentlet")
  .description("CLI for developing Agentlet agents")
  .version("0.1.0");

// ═══ CREATE COMMAND ═══

program
  .command("create")
  .description("Create a new agent from template")
  .argument("<name>", "Agent name")
  .option("-t, --template <type>", "Template type (minimal, universal, adaptive)", "minimal")
  .option("-o, --output <path>", "Output file path")
  .option("-d, --description <desc>", "Agent description")
  .option("-a, --author <name>", "Author name")
  .action(async (name: string, options) => {
    try {
      const template = options.template as TemplateType;
      const validTemplates = getTemplateNames();

      if (!validTemplates.includes(template)) {
        console.error(chalk.red(`Invalid template: ${template}`));
        console.log(`Available templates:`);
        for (const t of validTemplates) {
          console.log(`  ${chalk.cyan(t)}: ${getTemplateDescription(t)}`);
        }
        process.exit(1);
      }

      const outputPath = await createAgent({
        name,
        template,
        output: options.output,
        description: options.description,
        author: options.author,
      });

      console.log(chalk.green(`\u2713 Created ${outputPath}`));
      console.log(`\nTemplate: ${template}`);
      console.log(`\nNext steps:`);
      console.log(`  1. Edit your agent: ${chalk.cyan(outputPath)}`);
      console.log(`  2. Validate: ${chalk.cyan(`agentlet validate ${outputPath}`)}`);
      console.log(`  3. Test: ${chalk.cyan(`agentlet test ${outputPath}`)}`);
      console.log(`  4. Serve: ${chalk.cyan(`agentlet serve ${outputPath}`)}`);
    } catch (error) {
      const err = error as Error;
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// ═══ VALIDATE COMMAND ═══

program
  .command("validate")
  .description("Validate agent manifest and structure")
  .argument("<file>", "Agent file (.agentlet or .html)")
  .option("-v, --verbose", "Show detailed validation info")
  .action(async (file: string, options) => {
    try {
      const filePath = path.resolve(file);
      const result = await validateAgent(filePath, { verbose: options.verbose });

      console.log(formatValidationResult(result));

      if (!result.valid) {
        process.exit(1);
      }
    } catch (error) {
      const err = error as Error;
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// ═══ SERVE COMMAND ═══

program
  .command("serve")
  .description("Start development server for an agent")
  .argument("<file>", "Agent file (.agentlet or .html)")
  .option("-p, --port <number>", "Port number", "3456")
  .option("-w, --watch", "Watch for file changes")
  .option("-i, --inference <provider>", "Inference provider (mock, openai, ollama)", "mock")
  .option("-k, --api-key <key>", "API key for OpenAI (or set OPENAI_API_KEY env)")
  .option("-m, --model <name>", "Model name (e.g., gpt-4o-mini, llama3)")
  .option("--ollama-url <url>", "Ollama server URL", "http://localhost:11434")
  .action(async (file: string, options) => {
    try {
      const filePath = path.resolve(file);
      const port = parseInt(options.port, 10);

      if (isNaN(port) || port < 1 || port > 65535) {
        console.error(chalk.red("Invalid port number"));
        process.exit(1);
      }

      // Validate inference provider
      const validProviders = ["mock", "openai", "ollama"];
      if (!validProviders.includes(options.inference)) {
        console.error(chalk.red(`Invalid inference provider: ${options.inference}`));
        console.log(`Valid providers: ${validProviders.join(", ")}`);
        process.exit(1);
      }

      await serveAgent(filePath, {
        port,
        watch: options.watch,
        inference: options.inference as "mock" | "openai" | "ollama",
        apiKey: options.apiKey,
        model: options.model,
        ollamaUrl: options.ollamaUrl,
      });

      // Keep process running
      process.on("SIGINT", () => {
        console.log("\nStopping server...");
        process.exit(0);
      });
    } catch (error) {
      const err = error as Error;
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// ═══ TEST COMMAND ═══

program
  .command("test")
  .description("Run agent tests")
  .argument("<file>", "Agent file (.agentlet or .html)")
  .option("-a, --action <id>", "Test specific action only")
  .option("-t, --timeout <ms>", "Timeout in milliseconds", "5000")
  .option("-v, --verbose", "Show detailed test output")
  .action(async (file: string, options) => {
    try {
      const filePath = path.resolve(file);
      const timeout = parseInt(options.timeout, 10);

      console.log(chalk.cyan(`\nTesting ${path.basename(filePath)}...\n`));

      const result = await testAgent(filePath, {
        action: options.action,
        timeout,
        verbose: options.verbose,
      });

      console.log(formatTestResult(result));
      console.log();

      if (!result.passed) {
        process.exit(1);
      }
    } catch (error) {
      const err = error as Error;
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// ═══ LIST TEMPLATES ═══

program
  .command("templates")
  .description("List available agent templates")
  .action(() => {
    console.log(chalk.cyan("\nAvailable templates:\n"));
    for (const template of getTemplateNames()) {
      console.log(`  ${chalk.bold(template)}`);
      console.log(`    ${getTemplateDescription(template)}\n`);
    }
  });

// ═══ MAIN ═══

export async function main(): Promise<void> {
  await program.parseAsync(process.argv);
}

// Re-export commands for programmatic use
export { validateAgent, formatValidationResult } from "./commands/validate.js";
export { createAgent, getTemplateNames, getTemplateDescription } from "./commands/create.js";
export { serveAgent } from "./commands/serve.js";
export { testAgent, formatTestResult } from "./commands/test.js";
export type { TemplateType } from "./commands/create.js";
export type { ValidateOptions, ValidationResult } from "./commands/validate.js";
export type { ServeOptions, ServeResult } from "./commands/serve.js";
export type { TestOptions, TestResult } from "./commands/test.js";
