#!/bin/bash
# Create a source-only zip (no git, node_modules, or build artifacts)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATE=$(date +%Y-%m-%d)
OUTPUT_FILE="${PROJECT_DIR}/../agentlet-source-only-${DATE}.zip"

echo "Creating source-only zip from: $PROJECT_DIR"
echo "Output: $OUTPUT_FILE"

cd "$PROJECT_DIR"

# Remove old zip if exists
rm -f "$OUTPUT_FILE"

# Create zip excluding unwanted files
zip -r "$OUTPUT_FILE" . \
  -x "*.git*" \
  -x "*node_modules*" \
  -x "*/dist/*" \
  -x "*/.scaffold/*" \
  -x "*.onnx" \
  -x "*.bin" \
  -x "*.wasm" \
  -x "*.model" \
  -x "*.weights" \
  -x "*.pt" \
  -x "*.pth" \
  -x "*.safetensors" \
  -x "*.gguf" \
  -x "*.DS_Store" \
  -x "*.log" \
  -x "*.lock" \
  -x "package-lock.json" \
  -x "*.vsix" \
  -x "*.xpi" \
  -x "scripts/create-analysis-zip.sh"

# Show size
echo ""
echo "Created: $OUTPUT_FILE"
ls -lh "$OUTPUT_FILE"

# Show what's included (top-level)
echo ""
echo "Contents preview:"
unzip -l "$OUTPUT_FILE" | head -50
echo "..."
echo ""
echo "Total files:"
unzip -l "$OUTPUT_FILE" | tail -1
