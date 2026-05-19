#!/bin/bash
# Installs the ~/.kobiton/bin/kobiton symlink pointing at this plugin
# version's run.sh wrapper. Idempotent - safe to invoke repeatedly.
#
# Called from four places:
#   1. Claude Code's SessionStart hook (auto, every session). The
#      /automate:setup slash command also invokes it on demand.
#   2. GitHub Copilot CLI via the /automate:setup slash command -
#      Copilot loads Claude-format markdown commands, but has no
#      SessionStart hook, so users run /automate:setup once after
#      install.
#   3. Gemini CLI via the /automate:setup slash command - Gemini
#      loads bundled TOML commands at commands/automate/setup.toml,
#      which invokes this script upfront via !{...} as Step 0.
#   4. Direct bash invocation by users on Codex CLI - Codex's plugin
#      manifest has no `commands` field, so /automate:setup is
#      unavailable; users run this script via
#      `bash <plugin-path>/scripts/install-cli.sh` once after install.
#
# Plugin root resolution: prefer CLAUDE_PLUGIN_ROOT if the host CLI
# injected it; otherwise derive from this script's own location
# (`<plugin-root>/scripts/install-cli.sh`).

set -euo pipefail

if [ -n "${CLAUDE_PLUGIN_ROOT:-}" ]; then
  PLUGIN_ROOT="$CLAUDE_PLUGIN_ROOT"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

TARGET="${PLUGIN_ROOT}/skills/run-interactive-test/scripts/run.sh"
LINK="$HOME/.kobiton/bin/kobiton"

# Only act if the target script exists in this plugin
[ -f "$TARGET" ] || exit 0

mkdir -p "$HOME/.kobiton/bin"
ln -sf "$TARGET" "$LINK"
chmod +x "$TARGET"
