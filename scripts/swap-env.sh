#!/bin/bash
# Swap the Kobiton API host slug across MCP configs, docs, and test fixtures.
#
# Usage:
#   scripts/swap-env.sh <from> <to>
#
# Examples:
#   scripts/swap-env.sh test-white test-green   # api-test-white.kobiton.com -> api-test-green.kobiton.com
#   scripts/swap-env.sh test-green ''           # api-test-green.kobiton.com -> api.kobiton.com (back to prod)
#   scripts/swap-env.sh '' test-green           # api.kobiton.com -> api-test-green.kobiton.com
#
# An empty <from> or <to> means production (`api.kobiton.com`, no env slug).
#
# The pattern matched is `api[-<slug>].kobiton.com` so docs that list multiple
# environments as naming-convention examples are untouched unless they happen
# to match exactly the source host.

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <from-slug> <to-slug>" >&2
  echo "  Use '' for the production host (api.kobiton.com)." >&2
  exit 2
fi

FROM_SLUG="$1"
TO_SLUG="$2"

build_host() {
  if [ -z "$1" ]; then echo "api.kobiton.com"; else echo "api-$1.kobiton.com"; fi
}

FROM_HOST="$(build_host "$FROM_SLUG")"
TO_HOST="$(build_host "$TO_SLUG")"

if [ "$FROM_HOST" = "$TO_HOST" ]; then
  echo "from and to resolve to the same host ($FROM_HOST); nothing to do" >&2
  exit 0
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v git >/dev/null 2>&1; then
  echo "git is required" >&2
  exit 1
fi

FILES=()
while IFS= read -r -d '' f; do
  FILES+=("$f")
done < <(git grep -lz --fixed-strings "$FROM_HOST" -- \
  '*.json' '*.js' '*.md' '*.yaml' '*.yml' '*.toml' '*.sh' || true)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "No files reference $FROM_HOST"
  exit 0
fi

echo "Rewriting $FROM_HOST -> $TO_HOST in ${#FILES[@]} file(s):"
printf '  %s\n' "${FILES[@]}"

# BSD vs GNU sed compatibility for -i.
if sed --version >/dev/null 2>&1; then SED_INPLACE=(-i); else SED_INPLACE=(-i ''); fi

# Escape dots in the source host for the regex; the replacement is a literal.
ESCAPED_FROM="$(printf '%s' "$FROM_HOST" | sed 's/\./\\./g')"
sed "${SED_INPLACE[@]}" "s|${ESCAPED_FROM}|${TO_HOST}|g" "${FILES[@]}"

echo "Done. Review with: git diff"
