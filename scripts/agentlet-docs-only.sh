#!/bin/bash
# Create a zip of all markdown files with flattened path names
# e.g., hosts/zotero/DEVELOPMENT.md → hosts-zotero-DEVELOPMENT.md

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATE=$(date +%Y-%m-%d)
OUTPUT_FILE="${PROJECT_DIR}/../agentlet-docs-only-${DATE}.zip"
TEMP_DIR=$(mktemp -d)

echo "Creating docs-only zip from: $PROJECT_DIR"
echo "Output: $OUTPUT_FILE"

cd "$PROJECT_DIR"

# Remove old zip if exists
rm -f "$OUTPUT_FILE"

# Find all markdown files and copy with flattened names
find . -name "*.md" -type f \
  ! -path "./.git/*" \
  ! -path "*/node_modules/*" \
  ! -path "*/.scaffold/*" \
  ! -path "*/dist/*" \
  | while read -r file; do
    # Remove leading ./ and replace / with -
    flat_name=$(echo "$file" | sed 's|^\./||' | sed 's|/|-|g')
    cp "$file" "$TEMP_DIR/$flat_name"
done

# Create zip from temp directory
cd "$TEMP_DIR"
zip -r "$OUTPUT_FILE" .

# Cleanup
rm -rf "$TEMP_DIR"

# Show results
echo ""
echo "Created: $OUTPUT_FILE"
ls -lh "$OUTPUT_FILE"

echo ""
echo "Contents:"
unzip -l "$OUTPUT_FILE" | head -40
echo "..."
echo ""
unzip -l "$OUTPUT_FILE" | tail -1
