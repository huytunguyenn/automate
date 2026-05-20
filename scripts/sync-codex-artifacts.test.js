import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, readFileSync, existsSync, lstatSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {syncCodexArtifacts} from './sync-codex-artifacts.js'

function setupFixture(root) {
  mkdirSync(join(root, 'skills/run-foo'), {recursive: true})
  writeFileSync(join(root, 'skills/run-foo/SKILL.md'), '# Foo skill')
  mkdirSync(join(root, 'skills/run-bar/references'), {recursive: true})
  writeFileSync(join(root, 'skills/run-bar/SKILL.md'), '# Bar skill')
  writeFileSync(join(root, 'skills/run-bar/references/notes.md'), 'notes')

  mkdirSync(join(root, 'assets'))
  writeFileSync(join(root, 'assets/logo.svg'), '<svg/>')

  mkdirSync(join(root, '.codex'))
}

describe('syncCodexArtifacts', () => {
  let dir

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sync-codex-test-'))
  })

  afterEach(() => {
    rmSync(dir, {recursive: true, force: true})
  })

  describe('write mode', () => {
    it('copies skills/ and assets/ into .codex/ as real files', () => {
      setupFixture(dir)
      const errors = syncCodexArtifacts(dir)
      expect(errors).toEqual([])

      expect(existsSync(join(dir, '.codex/skills/run-foo/SKILL.md'))).toBe(true)
      expect(readFileSync(join(dir, '.codex/skills/run-foo/SKILL.md'), 'utf8')).toBe('# Foo skill')
      expect(readFileSync(join(dir, '.codex/skills/run-bar/references/notes.md'), 'utf8')).toBe('notes')
      expect(readFileSync(join(dir, '.codex/assets/logo.svg'), 'utf8')).toBe('<svg/>')

      expect(lstatSync(join(dir, '.codex/skills')).isDirectory()).toBe(true)
      expect(lstatSync(join(dir, '.codex/skills')).isSymbolicLink()).toBe(false)
      expect(lstatSync(join(dir, '.codex/assets')).isSymbolicLink()).toBe(false)
    })

    it('replaces a pre-existing symlink with a real directory', () => {
      setupFixture(dir)
      symlinkSync('../skills', join(dir, '.codex/skills'))
      expect(lstatSync(join(dir, '.codex/skills')).isSymbolicLink()).toBe(true)

      syncCodexArtifacts(dir)

      expect(lstatSync(join(dir, '.codex/skills')).isSymbolicLink()).toBe(false)
      expect(lstatSync(join(dir, '.codex/skills')).isDirectory()).toBe(true)
    })

    it('removes stale files from a prior sync', () => {
      setupFixture(dir)
      syncCodexArtifacts(dir)

      writeFileSync(join(dir, '.codex/skills/run-foo/STALE.md'), 'remove me')
      rmSync(join(dir, 'skills/run-bar'), {recursive: true})

      syncCodexArtifacts(dir)

      expect(existsSync(join(dir, '.codex/skills/run-foo/STALE.md'))).toBe(false)
      expect(existsSync(join(dir, '.codex/skills/run-bar'))).toBe(false)
    })

    it('reports an error if a source directory is missing', () => {
      mkdirSync(join(dir, '.codex'))
      mkdirSync(join(dir, 'assets'))
      writeFileSync(join(dir, 'assets/logo.svg'), '<svg/>')
      const errors = syncCodexArtifacts(dir)
      expect(errors).toContainEqual(expect.stringContaining('source skills does not exist'))
    })
  })

  describe('check mode', () => {
    it('passes when .codex/ is in sync', () => {
      setupFixture(dir)
      syncCodexArtifacts(dir)
      const errors = syncCodexArtifacts(dir, {check: true})
      expect(errors).toEqual([])
    })

    it('fails when .codex/skills is a symlink', () => {
      setupFixture(dir)
      symlinkSync('../skills', join(dir, '.codex/skills'))
      mkdirSync(join(dir, '.codex/assets'))
      const errors = syncCodexArtifacts(dir, {check: true})
      expect(errors).toContainEqual(expect.stringContaining('.codex/skills is a symlink'))
    })

    it('fails when .codex/ destination is missing', () => {
      setupFixture(dir)
      const errors = syncCodexArtifacts(dir, {check: true})
      expect(errors).toContainEqual(expect.stringContaining('.codex/skills missing'))
    })

    it('fails when content drifts', () => {
      setupFixture(dir)
      syncCodexArtifacts(dir)
      writeFileSync(join(dir, '.codex/skills/run-foo/SKILL.md'), '# modified after sync')
      const errors = syncCodexArtifacts(dir, {check: true})
      expect(errors).toContainEqual(expect.stringContaining('.codex/skills/run-foo/SKILL.md differs'))
    })

    it('fails when .codex/ has stale files not in source', () => {
      setupFixture(dir)
      syncCodexArtifacts(dir)
      writeFileSync(join(dir, '.codex/skills/run-foo/EXTRA.md'), 'stale')
      const errors = syncCodexArtifacts(dir, {check: true})
      expect(errors).toContainEqual(expect.stringContaining('.codex/skills/run-foo/EXTRA.md is stale'))
    })

    it('fails when source has files .codex/ is missing', () => {
      setupFixture(dir)
      syncCodexArtifacts(dir)
      writeFileSync(join(dir, 'skills/run-foo/NEW.md'), 'added')
      const errors = syncCodexArtifacts(dir, {check: true})
      expect(errors).toContainEqual(expect.stringContaining('.codex/skills/run-foo/NEW.md missing'))
    })
  })
})
