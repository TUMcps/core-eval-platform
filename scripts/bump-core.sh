#!/usr/bin/env bash
# Move a superproject's pinned ./core submodule to a specific core version.
#
# Ships in core so the variants (VNN-COMP, ARCH-COMP) share one copy. Run it from a
# variant that vendors this engine as a `./core` git submodule; it resolves that
# superproject automatically.
#
# Usage (from the variant root):
#   core/scripts/bump-core.sh           # latest origin/main
#   core/scripts/bump-core.sh dev       # latest origin/dev (any branch)
#   core/scripts/bump-core.sh <sha|tag> # an exact commit or tag
#
# Stages the new submodule pointer; review it, then commit to record the pin.
set -euo pipefail

ref="${1:-main}"
core="$(cd "$(dirname "$0")/.." && pwd)"
root="$(git -C "$core" rev-parse --show-superproject-working-tree)"
if [ -z "$root" ]; then
  echo "error: ./core is not a submodule here — run this from a variant that vendors it" >&2
  exit 1
fi

git -C "$core" fetch --tags --prune origin

# A branch resolves to its origin tip; a tag/commit is used verbatim.
if target="$(git -C "$core" rev-parse --verify --quiet "origin/$ref^{commit}")"; then
  :
elif target="$(git -C "$core" rev-parse --verify --quiet "$ref^{commit}")"; then
  :
else
  echo "error: ref '$ref' not found in core (tried origin/$ref and $ref)" >&2
  exit 1
fi

# Detached HEAD: a pinned submodule points at a commit, not a branch.
git -C "$core" checkout --quiet --detach "$target"
rel="${core#"$root"/}"
git -C "$root" add "$rel"

printf 'core pinned to %s (%s)\n' "$ref" "$(git -C "$core" rev-parse --short HEAD)"
printf 'review: git -C %s diff --cached %s\n' "$root" "$rel"
printf 'then commit to record the new pin.\n'
