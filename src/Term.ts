import { exec } from '@actions/exec';

const INSTALL_STEP = 'install';
const BUILD_STEP = 'build';

class Term {
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
      await exec(cleanScript, [], {
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
