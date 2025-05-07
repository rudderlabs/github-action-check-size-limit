import { exec } from '@actions/exec';
import hasYarn from 'has-yarn';
import hasPNPM from 'has-pnpm';
import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';

function hasBun(cwd = process.cwd()) {
  return fs.existsSync(path.resolve(cwd, 'bun.lockb'));
}

const INSTALL_STEP = 'install';
const BUILD_STEP = 'build';

class Term {
  /**
   * Autodetects and gets the current package manager for the current directory, either yarn, pnpm, bun,
   * or npm. Default is `npm`.
   *
   * @param directory The current directory
   * @returns The detected package manager in use, one of `yarn`, `pnpm`, `npm`, `bun`
   */
  getPackageManager(directory?: string): string {
    return hasYarn(directory)
      ? 'yarn'
      : hasPNPM(directory)
        ? 'pnpm'
        : hasBun(directory)
          ? 'bun'
          : 'npm';
  }

  async execSizeLimit(
    skipStep?: string,
    installScript?: string,
    buildScript?: string,
    cleanScript?: string,
    windowsVerbatimArguments?: boolean,
    directory?: string,
    script?: string,
    packageManager?: string,
    isMonorepo?: boolean,
  ): Promise<{ status: number; output: string }> {
    const manager = packageManager || this.getPackageManager(directory);
    let output = '';

    if (skipStep !== INSTALL_STEP && skipStep !== BUILD_STEP) {
      const scriptToExec = installScript || 'ci';

      console.log('install', scriptToExec, !isMonorepo ? directory : process.cwd());
      await exec(scriptToExec === 'ci' ? `${manager} ci` : `${manager} run ${scriptToExec}`, [], {
        cwd: !isMonorepo ? directory : process.cwd(),
      });
    }

    if (skipStep !== BUILD_STEP) {
      const scriptToExec = buildScript || 'build';

      console.log('build', scriptToExec, directory);
      await exec(`${manager} run ${scriptToExec}`, [], {
        cwd: directory,
      });
    }

    console.log('check', script, directory);
    const status = await exec(script, [], {
      windowsVerbatimArguments,
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
      },
      cwd: directory,
    });

    if (cleanScript) {
      console.log('clean', cleanScript, directory);
      await exec(`${manager} run ${cleanScript}`, [], {
        cwd: directory,
      });
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
