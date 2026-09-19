import '@jest/globals';
import { exec, ExecOptions } from '@actions/exec';
import Term from './Term';

jest.mock('@actions/exec');

const mockedExec = exec as jest.MockedFunction<typeof exec>;

const CHECK_SCRIPT = 'npx size-limit --json';
const DEFAULT_CLEAN_SCRIPT = 'git clean -fdx -e node_modules -e .*';
const CUSTOM_CLEAN_SCRIPT = 'npm run clean';
const RESULTS = JSON.stringify([
  {
    name: 'dist/index.js',
    passed: true,
    size: '110894',
    sizeLimit: '120000',
  },
]);

const executedScripts = () => mockedExec.mock.calls.map(call => call[0]);

const writeResults = (commandLine: string, options: ExecOptions) => {
  if (commandLine === CHECK_SCRIPT) {
    options.listeners.stdout(Buffer.from(RESULTS));
  }
};

describe('Term', () => {
  beforeEach(() => {
    mockedExec.mockImplementation(async (commandLine, args, options) => {
      writeResults(commandLine, options);
      return 0;
    });
  });

  test('should clean the build output before the build when no clean script is given', async () => {
    const term = new Term();

    const { status, output } = await term.execSizeLimit(
      null,
      null,
      null,
      null,
      false,
      'client',
      CHECK_SCRIPT,
      false,
    );

    expect(executedScripts()).toEqual(['ci', DEFAULT_CLEAN_SCRIPT, 'build', CHECK_SCRIPT]);
    expect(status).toBe(0);
    expect(output).toBe(RESULTS);
  });

  test('should not run the default clean when the build step is skipped', async () => {
    const term = new Term();

    await term.execSizeLimit('build', null, null, null, false, 'client', CHECK_SCRIPT, false);

    expect(executedScripts()).toEqual([CHECK_SCRIPT]);
  });

  test('should run a custom clean script after the check only', async () => {
    // a clean_script may remove dependencies, so it must never run before the build
    const term = new Term();

    await term.execSizeLimit(
      null,
      null,
      null,
      CUSTOM_CLEAN_SCRIPT,
      false,
      'client',
      CHECK_SCRIPT,
      false,
    );

    expect(executedScripts()).toEqual(['ci', 'build', CHECK_SCRIPT, CUSTOM_CLEAN_SCRIPT]);
  });

  test('should clean after the check even when the size script throws', async () => {
    mockedExec.mockImplementation(async commandLine => {
      if (commandLine === CHECK_SCRIPT) {
        throw new Error('size script crashed');
      }

      return 0;
    });

    const term = new Term();

    await expect(
      term.execSizeLimit(
        null,
        null,
        null,
        CUSTOM_CLEAN_SCRIPT,
        false,
        'client',
        CHECK_SCRIPT,
        false,
      ),
    ).rejects.toThrow('size script crashed');

    expect(executedScripts()).toEqual(['ci', 'build', CHECK_SCRIPT, CUSTOM_CLEAN_SCRIPT]);
  });

  test('should not clean before the check when the build step is skipped', async () => {
    const term = new Term();

    await term.execSizeLimit(
      'build',
      null,
      null,
      CUSTOM_CLEAN_SCRIPT,
      false,
      'client',
      CHECK_SCRIPT,
      false,
    );

    expect(executedScripts()).toEqual([CHECK_SCRIPT, CUSTOM_CLEAN_SCRIPT]);
  });

  test('should keep going when the default clean fails', async () => {
    mockedExec.mockImplementation(async (commandLine, args, options) => {
      if (commandLine === DEFAULT_CLEAN_SCRIPT) {
        throw new Error('not a git repository');
      }

      writeResults(commandLine, options);
      return 0;
    });

    const term = new Term();

    await expect(
      term.execSizeLimit(null, null, null, null, false, 'client', CHECK_SCRIPT, false),
    ).resolves.toEqual({ status: 0, output: RESULTS });
  });

  test('should fail when a custom clean script fails', async () => {
    mockedExec.mockImplementation(async commandLine => {
      if (commandLine === CUSTOM_CLEAN_SCRIPT) {
        throw new Error('clean failed');
      }

      return 0;
    });

    const term = new Term();

    await expect(
      term.execSizeLimit(
        null,
        null,
        null,
        CUSTOM_CLEAN_SCRIPT,
        false,
        'client',
        CHECK_SCRIPT,
        false,
      ),
    ).rejects.toThrow('clean failed');
  });
});
