import type { EnvSource } from '#primitives/exec/api';
import {
  createBoundExec,
  type BoundExec,
  type ExecBufferResult,
  type ExecOptions,
  type ExecResult,
  type ExecSpawnOptions,
} from '#services/exec/api';
import { shouldUseDefaultBatchModeSsh } from '#services/exec/node/git-ssh-command';
import { gitRuntimeEnv } from '../non-interactive-env';

export type CreateGitExecOptions = {
  cwd: string;
  executable?: string;
  env: NodeJS.ProcessEnv | EnvSource;
};

/**
 * Full child environment for git invocations. Git needs the process env (PATH, HOME,
 * SSH_AUTH_SOCK, credential helpers), so it is composed in deliberately — exec itself
 * never merges `process.env`.
 */
export function gitEnv(base: NodeJS.ProcessEnv, useDefaultSsh = false): NodeJS.ProcessEnv {
  const env = gitRuntimeEnv(base);
  return {
    ...env,
    LC_ALL: 'C',
    LANG: 'C',
    LANGUAGE: 'C',
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'never',
    GIT_ASKPASS: '',
    SSH_ASKPASS: '',
    // Leave Git's core.sshCommand (or an explicit GIT_SSH_COMMAND) in control of key routing.
    SSH_ASKPASS_REQUIRE: 'never',
    ...(useDefaultSsh && !env.GIT_SSH_COMMAND ? { GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' } : {}),
  };
}

export function createGitExec(options: CreateGitExecOptions): BoundExec {
  const source = options.env;
  const executable = options.executable ?? 'git';
  const env = async () => {
    const base = typeof source === 'function' ? await source() : source;
    const useDefaultSsh = await shouldUseDefaultBatchModeSsh(executable, options.cwd, base);
    return gitEnv(base, useDefaultSsh);
  };
  const bound = createBoundExec({
    file: executable,
    cwd: options.cwd,
    env,
  });
  return Object.assign(bound, {
    withCwd(cwd: string) {
      return createGitExec({ ...options, cwd });
    },
  });
}

/** Targets every command at one Git directory, independently of the executor's cwd. */
export function bindGitDir(base: BoundExec, gitDir: string): BoundExec {
  const prefix = [`--git-dir=${gitDir}`];
  return {
    file: base.file,
    cwd: base.cwd,
    env: base.env,
    exec(args: string[], options?: ExecOptions): Promise<ExecResult> {
      return base.exec([...prefix, ...args], options);
    },
    execStreaming(
      args: string[],
      onStdout: (chunk: string) => boolean | void,
      options?: ExecOptions
    ): Promise<void> {
      return base.execStreaming([...prefix, ...args], onStdout, options);
    },
    execBuffer(args: string[], options?: ExecOptions): Promise<ExecBufferResult> {
      return base.execBuffer([...prefix, ...args], options);
    },
    spawn(args: string[], options?: ExecSpawnOptions) {
      return base.spawn([...prefix, ...args], options);
    },
    withCwd(cwd: string): BoundExec {
      return bindGitDir(base.withCwd(cwd), gitDir);
    },
  };
}
