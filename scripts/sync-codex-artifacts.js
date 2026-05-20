// Mirror skills/ and assets/ into .codex/ as real files (not symlinks).
//
// Codex CLI's plugin installer (openai/codex `core-plugins/src/store.rs` `copy_dir_recursive`) silently skips symlinks,
// so .codex/skills and .codex/assets must be real directories with real files for the Codex install path to expose skills
// and brand assets.
//
// Tracked upstream at https://github.com/openai/codex/issues/11314 - when that lands and is widely rolled out, this script
// (and the .codex/ mirror it produces) can be replaced with symlinks again.
//
// Source of truth lives at the repo root (skills/, assets/); .codex/skills and .codex/assets are derived and kept in sync
// by this script. Run in:
//  --write mode to refresh them
//  --check mode (used by validate / CI) to fail if they drift

import {existsSync, lstatSync, rmSync, cpSync, readdirSync, readFileSync, statSync} from 'node:fs'
import {join, resolve, relative} from 'node:path'

const PAIRS = [
  {src: 'skills', dest: '.codex/skills'},
  {src: 'assets', dest: '.codex/assets'}
]

function listFiles(root) {
  const out = []
  function walk(dir) {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      }
      else if (entry.isFile()) {
        out.push(relative(root, full))
      }
      else if (entry.isSymbolicLink()) {
        // Resolve symlink; if it points at a file, include it.
        const stat = statSync(full, {throwIfNoEntry: false})
        if (stat?.isFile()) {
          out.push(relative(root, full))
        }
      }
    }
  }
  walk(root)
  return out.sort()
}

function compareTrees(srcRoot, destRoot) {
  const srcFiles = listFiles(srcRoot)
  const destFiles = listFiles(destRoot)

  const missing = srcFiles.filter((f) => !destFiles.includes(f))
  const extra = destFiles.filter((f) => !srcFiles.includes(f))
  const differing = []
  for (const f of srcFiles) {
    if (!destFiles.includes(f)) continue
    const a = readFileSync(join(srcRoot, f))
    const b = readFileSync(join(destRoot, f))
    if (!a.equals(b)) {
      differing.push(f)
    }
  }
  return {missing, extra, differing}
}

export function syncCodexArtifacts(rootDir, {check = false} = {}) {
  const errors = []

  for (const {src, dest} of PAIRS) {
    const srcPath = join(rootDir, src)
    const destPath = join(rootDir, dest)

    if (!existsSync(srcPath)) {
      errors.push(`source ${src} does not exist`)
      continue
    }

    if (check) {
      const destStat = lstatSync(destPath, {throwIfNoEntry: false})
      if (!destStat) {
        errors.push(`${dest} missing — run \`pnpm run build:codex\``)
        continue
      }
      if (destStat.isSymbolicLink()) {
        errors.push(`${dest} is a symlink, expected a real directory — run \`pnpm run build:codex\``)
        continue
      }
      if (!destStat.isDirectory()) {
        errors.push(`${dest} is not a directory`)
        continue
      }
      const {missing, extra, differing} = compareTrees(srcPath, destPath)
      for (const f of missing) errors.push(`${dest}/${f} missing (out of sync with ${src}/${f})`)
      for (const f of extra) errors.push(`${dest}/${f} is stale (no matching file in ${src}/)`)
      for (const f of differing) errors.push(`${dest}/${f} differs from ${src}/${f}`)
    }
    else {
      const destStat = lstatSync(destPath, {throwIfNoEntry: false})
      if (destStat) {
        rmSync(destPath, {recursive: true, force: true})
      }
      cpSync(srcPath, destPath, {recursive: true, dereference: true})
    }
  }

  return errors
}

// CLI runner
const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  const ROOT = resolve(import.meta.dirname, '..')
  const check = process.argv.includes('--check')
  const errors = syncCodexArtifacts(ROOT, {check})

  if (errors.length > 0) {
    for (const msg of errors) console.error(`FAIL: ${msg}`)
    process.exit(1)
  }

  if (check) {
    console.log('.codex/skills and .codex/assets are in sync with source.')
  }
  else {
    for (const {src, dest} of PAIRS) console.log(`Synced ${src} → ${dest}`)
  }
}
