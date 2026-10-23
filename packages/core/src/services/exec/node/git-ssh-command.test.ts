import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { shouldUseDefaultBatchModeSsh } from './git-ssh-command';

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('shouldUseDefaultBatchModeSsh', () => {
  it('uses Git config to preserve a custom SSH command', async () => {
    const cwd = await mkdtemp(path.join(os.tmpdir(), 'emdash-git-ssh-'));
    dirs.push(cwd);
    const config = path.join(cwd, 'global.gitconfig');
    await writeFile(config, '[core]\n\tsshCommand = git-router ssh-wrap\n');
    const env = {
      PATH: process.env.PATH,
      GIT_CONFIG_GLOBAL: config,
      GIT_CONFIG_NOSYSTEM: '1',
    };

    expect(await shouldUseDefaultBatchModeSsh('git', cwd, env)).toBe(false);
    expect(
      await shouldUseDefaultBatchModeSsh('git', cwd, { ...env, GIT_SSH_COMMAND: 'custom' })
    ).toBe(false);

    await writeFile(config, '');
    expect(await shouldUseDefaultBatchModeSsh('git', cwd, env)).toBe(true);
  });
});
