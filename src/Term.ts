import { exec } from '@actions/exec';

const INSTALL_STEP = 'install';
const BUILD_STEP = 'build';

// Used when no clean_script is provided. It removes the untracked and ignored build output so
// that a run never measures artifacts left behind by the previous one. Dependencies and dot
// entries (local configuration and build tool caches) are excluded from the clean.
const DEFAULT_CLEAN_SCRIPT = 'git clean -fdx -e node_modules -e .*';

class Term {
  private async clean(cleanScript?: string, directory?: string): Promise<void> {
    const scriptToExec = cleanScript || DEFAULT_CLEAN_SCRIPT;

    console.log('clean', scriptToExec, directory);

    try {
      await exec(scriptToExec, [], {
        cwd: directory,
      });
    } catch (error) {
      // A clean_script is the consumer's own contract, so its failure stays fatal. The default
      // one is not, it must not break repositories where it cannot run.
      if (cleanScript) {
        throw error;
      }

      console.log('Clean failed', error.message);
    }
  }

  // A clean_script is documented to run after the results are collected and may remove anything,
  // dependencies included, so it keeps that placement. The default clean runs first instead, so a
  // run never measures the previous one's output and never deletes what the install just generated.

  async execSizeLimit(
    skipStep?: string,
    installScript?: string,
    buildScript?: string,
    cleanScript?: string,
    windowsVerbatimArguments?: boolean,
    directory?: string,
    script?: string,
    isMonorepo?: boolean,
  ): Promise<{ status: number; output: string }> {
    let output = '';

    // Before the install, not between install and build: install scripts can
    // generate ignored files the build needs, and the default clean removes
    // ignored files. Skipped when the build is, because then the artifacts being
    // measured are the ones already on disk.
    if (!cleanScript && skipStep !== BUILD_STEP) {
      await this.clean(cleanScript, directory);
    }

    if (skipStep !== INSTALL_STEP && skipStep !== BUILD_STEP) {
      const scriptToExec = installScript || 'ci';

      console.log('install', scriptToExec, directory);
      await exec(scriptToExec, [], {
        cwd: directory,
      });
    }

    if (skipStep !== BUILD_STEP) {
      const scriptToExec = buildScript || 'build';

      console.log('build', scriptToExec, directory);
      await exec(scriptToExec, [], {
        cwd: directory,
      });
    }

    console.log('check', script, directory);
    let status: number;

    try {
      status = await exec(script, [], {
        windowsVerbatimArguments,
        ignoreReturnCode: true,
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
        cwd: directory,
      });
    } finally {
      if (cleanScript) {
        await this.clean(cleanScript, directory);
      }
    }

    if (isMonorepo) {
      output = JSON.stringify(
        output
          .trim()
          .split(/\n(?=\[)/)
          .map(line => JSON.parse(line)),
      );
    }

    return {
      status,
      output,
    };
  }
}

export default Term;
