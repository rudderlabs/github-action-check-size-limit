import { exec } from "@actions/exec";
import hasYarn from "has-yarn";
import hasPNPM from "has-pnpm";

const INSTALL_STEP = "install";
const BUILD_STEP = "build";

class Term {
  /**
   * Auto detects and gets the current package manager for the current directory, either yarn, pnpm,
   * or npm. Default is `npm`.
   *
   * @param directory The current directory
   * @returns The detected package manager in use, one of `yarn`, `pnpm`, `npm`
   */
  getPackageManager(directory?: string): string {
    return hasYarn(directory) ? "yarn" : hasPNPM(directory) ? "pnpm" : "npm";
  }

  async execSizeLimit(
    branch?: string,
    skipStep?: string,
    installScript?: string,
    buildScript?: string,
    cleanScript?: string,
    windowsVerbatimArguments?: boolean,
    directory?: string,
    script?: string,
    packageManager?: string,
    isMonorepo?: boolean
  ): Promise<{ status: number; output: string }> {
    const manager = packageManager || this.getPackageManager(directory);
    let output = isMonorepo ? "[" : "";

    if (branch) {
      try {
        console.log("Fetching", branch);
        await exec(`git fetch origin ${branch} --depth=1`);
      } catch (error) {
        console.log("Fetch failed", error.message);
      }

      console.log("checkout", branch);
      await exec(`git checkout -f ${branch}`);
    }

    if (skipStep !== INSTALL_STEP && skipStep !== BUILD_STEP) {
      const script = installScript || "ci";

      console.log("install", script, !isMonorepo ? directory : process.cwd());
      await exec(
        script === "ci" ? `${manager} ci` : `${manager} run ${script}`,
        [],
        {
          cwd: !isMonorepo ? directory : process.cwd()
        }
      );
    }

    if (skipStep !== BUILD_STEP) {
      const script = buildScript || "build";

      console.log("build", script, directory);
      await exec(`${manager} run ${script}`, [], {
        cwd: directory
      });
    }

    console.log("check", script, directory);
    const status = await exec(script, [], {
      windowsVerbatimArguments,
      ignoreReturnCode: true,
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
          if (isMonorepo) {
            output += ", ";
          }
        }
      },
      cwd: directory
    });

    if (cleanScript) {
      console.log("clean", cleanScript, directory);
      await exec(`${manager} run ${cleanScript}`, [], {
        cwd: directory
      });
    }

    if (isMonorepo) {
      output += "[]\n]";
    }

    return {
      status,
      output
    };
  }
}

export default Term;
