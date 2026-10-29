#!/usr/bin/env bash
# Create a reviewed, production-only main candidate. Never force-update main.
# Usage: bash scripts/prepare-main-release.sh [source-ref] [base-ref] [release-branch]
set -euo pipefail

source_ref="${1:-origin/dev}"
base_ref="${2:-origin/main}"
release_branch="${3:-release/main-$(date -u +%Y%m%d-%H%M%S)}"

if [[ ! "$release_branch" =~ ^release/main-[A-Za-z0-9._-]+$ ]]; then
  echo "Release branch must be named release/main-<identifier>." >&2
  exit 2
fi

root="$(git rev-parse --show-toplevel)"
source_sha="$(git -C "$root" rev-parse --verify "$source_ref^{commit}")"
base_sha="$(git -C "$root" rev-parse --verify "$base_ref^{commit}")"

if git -C "$root" show-ref --verify --quiet "refs/heads/$release_branch"; then
  echo "Release branch already exists: $release_branch" >&2
  exit 2
fi

# The candidate must come from a complete dev tree; never silently omit the
# release README, license, server, Prisma schema, or validation workflow.
for required in LICENSE release/README.md package.json bun.lock prisma/schema.prisma \
  src/app/page.tsx .github/workflows/dev-validation.yml scripts/validate-content.ts; do
  if ! git -C "$root" cat-file -e "$source_sha:$required" 2>/dev/null; then
    echo "Missing required release source: $required" >&2
    exit 2
  fi
done

candidate_dir="$(mktemp -d -t vanguard-main-release-XXXXXXXX)"
rmdir "$candidate_dir"
committed=0
cleanup() {
  if [[ -d "$candidate_dir" ]]; then
    git -C "$root" worktree remove --force "$candidate_dir" >/dev/null 2>&1 || true
  fi
  if [[ "$committed" == 0 ]] && git -C "$root" show-ref --verify --quiet "refs/heads/$release_branch"; then
    git -C "$root" branch -D -- "$release_branch" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

# Start from main rather than merging all dev history. This avoids force pushes,
# preserves release rollback history, and yields a reviewable main-targeted PR.
git -C "$root" worktree add -q -b "$release_branch" "$candidate_dir" "$base_sha"
git -C "$candidate_dir" rm -rq -- .

selected=()
while IFS= read -r -d '' path; do
  case "$path" in
    src/*|public/*|mini-services/*|prisma/schema.prisma|scripts/validate-content.ts|\
.github/workflows/dev-validation.yml|.gitignore|Caddyfile|LICENSE|bun.lock|\
components.json|eslint.config.mjs|next.config.ts|package.json|postcss.config.mjs|tsconfig.json)
      selected+=("$path") ;;
  esac
done < <(git -C "$root" ls-tree -r -z --name-only "$source_sha")

if (( ${#selected[@]} == 0 )); then
  echo "No production paths were selected; refusing to create an empty release." >&2
  exit 2
fi
git -C "$candidate_dir" checkout "$source_sha" -- "${selected[@]}" release/README.md
mv "$candidate_dir/release/README.md" "$candidate_dir/README.md"
rmdir "$candidate_dir/release"

# Keep tests, internal notes, planning docs, developer automation and npm's
# duplicate lockfile on dev. They are not part of the release source snapshot.
git -C "$candidate_dir" add -A
if git -C "$candidate_dir" diff --cached --quiet; then
  echo "No content difference from main; nothing to release." >&2
  exit 2
fi
git -C "$candidate_dir" -c commit.gpgsign=false commit -qm "release: curate main source from dev $source_sha" \
  -m "Source-dev: $source_sha" -m "Base-main: $base_sha"

release_sha="$(git -C "$candidate_dir" rev-parse HEAD)"
for prohibited in tests docs AGENTS.md package-lock.json \
  .github/workflows/afterlight-dev-validation.yml scripts/prepare-main-release.sh; do
  if [[ -n "$(git -C "$candidate_dir" ls-tree -r --name-only HEAD -- "$prohibited")" ]]; then
    echo "Candidate unexpectedly includes development-only path: $prohibited" >&2
    exit 1
  fi
done
committed=1
printf 'Release branch: %s\nCandidate SHA: %s\nSource dev SHA: %s\nBase main SHA: %s\n' \
  "$release_branch" "$release_sha" "$source_sha" "$base_sha"
printf 'Review the branch, push it without force, and open a PR to main. Main is unchanged.\n'
