/**
 * create command - Scaffold new agent projects
 *
 * Creates new agent files from templates based on the
 * examples in the Agentlet repository.
 */

import * as fs from "node:fs";
import * as path from "node:path";

export type TemplateType = "minimal" | "universal" | "adaptive";

export interface CreateOptions {
  name: string;
  template: TemplateType;
  output?: string;
  description?: string;
  author?: string;
}

// ═══ TEMPLATES ═══

const MINIMAL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{name}}</title>

  <!-- Agentlet Manifest -->
  <meta name="agentlet" content="0.1">
  <meta name="agentlet:name" content="{{name}}">
  <meta name="agentlet:version" content="1.0.0">
  <meta name="agentlet:description" content="{{description}}">
  <meta name="agentlet:author" content="{{author}}">
  <meta name="agentlet:portability" content="universal">

  <!-- Capabilities -->
  <meta name="agentlet:capability" content="inference">

  <!-- Actions -->
  <meta name="agentlet:action" content="run" data-label="Run" data-description="Execute the agent">
</head>
<body>
  <script type="module">
    // Wait for bridge to be available
    const bridge = window.bridge;

    bridge.onAction("run", async (params) => {
      try {
        await bridge.activity.start("Running agent...");

        const result = await bridge.inference({
          messages: [
            { role: "user", content: "Say hello!" }
          ],
          max_tokens: 100
        });

        await bridge.ui.notify({ message: result.content, type: "success" });
        await bridge.activity.complete("Done!");
      } catch (error) {
        await bridge.activity.error(error.message);
      }
    });

    bridge.onReady();
  </script>
</body>
</html>`;

const UNIVERSAL_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{name}}</title>

  <!-- Agentlet Manifest -->
  <meta name="agentlet" content="0.1">
  <meta name="agentlet:name" content="{{name}}">
  <meta name="agentlet:version" content="1.0.0">
  <meta name="agentlet:description" content="{{description}}">
  <meta name="agentlet:author" content="{{author}}">
  <meta name="agentlet:portability" content="universal">

  <!-- Capabilities -->
  <meta name="agentlet:capability" content="inference">
  <meta name="agentlet:capability" content="storage">

  <!-- Preferences -->
  <meta name="agentlet:preference" content="tone" data-type="select" data-label="Response Tone" data-default="professional">
  <meta name="agentlet:preference:option" content="tone:professional" data-label="Professional">
  <meta name="agentlet:preference:option" content="tone:casual" data-label="Casual">
  <meta name="agentlet:preference:option" content="tone:friendly" data-label="Friendly">

  <!-- Actions -->
  <meta name="agentlet:action" content="improve" data-label="Improve Text" data-description="Improve the selected text">
</head>
<body>
  <script type="module">
    const bridge = window.bridge;

    bridge.onAction("improve", async (params) => {
      try {
        await bridge.activity.start("Improving text...");

        // Get user's tone preference
        const tone = await bridge.storage.get("tone") || "professional";

        // Get input text (from params or prompt user)
        let text = params.text;
        if (!text) {
          text = await bridge.ui.prompt("Enter text to improve:");
          if (!text) {
            await bridge.activity.complete("Cancelled");
            return;
          }
        }

        await bridge.activity.step("Analyzing text...");

        const result = await bridge.inference({
          messages: [
            {
              role: "system",
              content: \`You are a helpful writing assistant. Improve the user's text while maintaining a \${tone} tone. Return only the improved text.\`
            },
            {
              role: "user",
              content: text
            }
          ],
          max_tokens: 1000
        });

        await bridge.ui.notify({ message: "Text improved!", type: "success" });
        await bridge.activity.complete("Done!");

        return { improved: result.content };
      } catch (error) {
        await bridge.activity.error(error.message);
        throw error;
      }
    });

    bridge.onReady();
  </script>
</body>
</html>`;

const ADAPTIVE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{name}}</title>

  <!-- Agentlet Manifest -->
  <meta name="agentlet" content="0.1">
  <meta name="agentlet:name" content="{{name}}">
  <meta name="agentlet:version" content="1.0.0">
  <meta name="agentlet:description" content="{{description}}">
  <meta name="agentlet:author" content="{{author}}">
  <meta name="agentlet:portability" content="adaptive">

  <!-- Capabilities -->
  <meta name="agentlet:capability" content="inference">
  <meta name="agentlet:capability" content="storage">

  <!-- Intents (what actions can be performed on items) -->
  <meta name="agentlet:intent" content="tag">
  <meta name="agentlet:intent" content="organize">

  <!-- Actions -->
  <meta name="agentlet:action" content="organize" data-label="Organize Items" data-description="AI-powered organization of selected items">
</head>
<body>
  <script type="module">
    const bridge = window.bridge;

    bridge.onAction("organize", async (params) => {
      try {
        await bridge.activity.start("Analyzing environment...");

        // Use perceive to understand the current context
        const context = await bridge.perceive({
          scope: "selection",
          understand: true
        });

        if (context.items.length === 0) {
          await bridge.ui.notify({ message: "No items selected", type: "warning" });
          await bridge.activity.complete("No items to organize");
          return;
        }

        await bridge.activity.step(\`Found \${context.items.length} items in \${context.host}\`);
        await bridge.activity.log(\`Host capabilities: \${context.capabilities.join(", ")}\`);

        // Use AI to understand the items and suggest organization
        const result = await bridge.inference({
          messages: [
            {
              role: "system",
              content: \`You are an organization assistant. Analyze the items and suggest how to organize them.
Host: \${context.host}
Understanding: \${context.understanding || "No additional context"}

Return a JSON object with:
{
  "groups": [{ "name": "Group Name", "items": [indices], "tags": ["tag1", "tag2"] }],
  "reasoning": "Brief explanation"
}\`
            },
            {
              role: "user",
              content: \`Organize these items:\\n\${JSON.stringify(context.items, null, 2)}\`
            }
          ],
          max_tokens: 1000
        });

        // Parse the AI response
        let plan;
        try {
          const jsonMatch = result.content.match(/\\{[\\s\\S]*\\}/);
          plan = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
        } catch {
          await bridge.activity.error("Failed to parse organization plan");
          return;
        }

        if (!plan || !plan.groups) {
          await bridge.activity.error("Invalid organization plan");
          return;
        }

        await bridge.activity.step(\`Organizing into \${plan.groups.length} groups...\`);

        // Apply tags to each group using the act() API
        for (const group of plan.groups) {
          if (group.tags && group.tags.length > 0) {
            const groupItems = group.items.map(i => context.items[i]);
            await bridge.act({
              intent: "tag",
              items: groupItems,
              tags: group.tags
            });
          }
        }

        await bridge.ui.notify({
          message: \`Organized \${context.items.length} items into \${plan.groups.length} groups\`,
          type: "success"
        });
        await bridge.activity.complete("Organization complete!");

      } catch (error) {
        await bridge.activity.error(error.message);
        throw error;
      }
    });

    bridge.onReady();
  </script>
</body>
</html>`;

const TEMPLATES: Record<TemplateType, string> = {
  minimal: MINIMAL_TEMPLATE,
  universal: UNIVERSAL_TEMPLATE,
  adaptive: ADAPTIVE_TEMPLATE,
};

/**
 * Create a new agent from template
 */
export async function createAgent(options: CreateOptions): Promise<string> {
  const { name, template, output, description, author } = options;

  // Get template content
  const templateContent = TEMPLATES[template];
  if (!templateContent) {
    throw new Error(`Unknown template: ${template}. Available: ${Object.keys(TEMPLATES).join(", ")}`);
  }

  // Replace placeholders
  let content = templateContent
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{description\}\}/g, description || `A ${template} Agentlet agent`)
    .replace(/\{\{author\}\}/g, author || "");

  // Determine output path
  const fileName = name.toLowerCase().replace(/\\s+/g, "-") + ".agentlet";
  const outputPath = output ? path.resolve(output) : path.join(process.cwd(), fileName);

  // Check if file exists
  if (fs.existsSync(outputPath)) {
    throw new Error(`File already exists: ${outputPath}`);
  }

  // Create directory if needed
  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Write file
  fs.writeFileSync(outputPath, content, "utf-8");

  return outputPath;
}

/**
 * Get available template names
 */
export function getTemplateNames(): TemplateType[] {
  return Object.keys(TEMPLATES) as TemplateType[];
}

/**
 * Get template description
 */
export function getTemplateDescription(template: TemplateType): string {
  const descriptions: Record<TemplateType, string> = {
    minimal: "Basic agent with inference capability and one action",
    universal: "Host-independent agent with storage and preferences",
    adaptive: "AI-powered agent that adapts to any host using perceive/act",
  };
  return descriptions[template];
}
