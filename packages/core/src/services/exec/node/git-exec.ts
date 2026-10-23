import { createBoundExec, type BoundExec } from '#services/exec/api';
import { shouldUseDefaultBatchModeSsh } from './git-ssh-command';

export type GitExecFactory = (cwd: string) => BoundExec;

/**
 * Non-interactive git exec bound to `cwd`. Git needs the full process env (PATH, HOME,
 * SSH_AUTH_SOCK, credential helpers), so it is composed in here — exec itself never
 * merges `process.env`. Every prompt channel is disabled so background git work fails
 * fast instead of blocking on credential or host-key input.
 */
export function createNonInteractiveGitExec(cwd: string): BoundExec {
  const base = process.env;
  const bound = createBoundExec({
    file: 'git',
    cwd,
    env: async () => ({
      ...base,
      LC_ALL: 'C',
      LANG: 'C',
      LANGUAGE: 'C',
      GIT_TERMINAL_PROMPT: '0',
      GCM_INTERACTIVE: 'never',
      GIT_ASKPASS: '',
      SSH_ASKPASS: '',
      // Git's core.sshCommand may select a key for the repository's host or org.
      SSH_ASKPASS_REQUIRE: 'never',
      ...((await shouldUseDefaultBatchModeSsh('git', cwd, base)) && !base.GIT_SSH_COMMAND
        ? { GIT_SSH_COMMAND: 'ssh -o BatchMode=yes' }
        : {}),
    }),
  });
  return Object.assign(bound, {
    withCwd(nextCwd: string) {
      return createNonInteractiveGitExec(nextCwd);
    },
  });
}

export const defaultGitExecFactory: GitExecFactory = (cwd) => createNonInteractiveGitExec(cwd);
