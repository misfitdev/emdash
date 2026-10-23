import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Use plain SSH in batch mode only when Git has no SSH command of its own. */
export async function shouldUseDefaultBatchModeSsh(
  executable: string,
  cwd: string,
  env: NodeJS.ProcessEnv
): Promise<boolean> {
  if (env.GIT_SSH_COMMAND) return false;

  try {
    const { stdout } = await execFileAsync(executable, ['config', '--get', 'core.sshCommand'], {
      cwd,
      env,
    });
    return !stdout.trim();
  } catch (error) {
    // Git exits 1 when the key is absent. Other failures should not mask user configuration.
    return error instanceof Error && 'code' in error && error.code === 1;
  }
}
