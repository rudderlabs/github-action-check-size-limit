import '@jest/globals';

const mockGetInput = jest.fn();
const mockSetFailed = jest.fn();
const mockExecSizeLimit = jest.fn();

jest.mock('@actions/core', () => ({
  getInput: (name: string) => mockGetInput(name),
  setFailed: (message: string) => mockSetFailed(message),
}));

jest.mock('@actions/exec', () => ({
  exec: async () => 0,
}));

// markdown-table ships as ESM only, which jest does not transform here
jest.mock('markdown-table', () => ({
  markdownTable: (rows: string[][]) => JSON.stringify(rows),
}));

jest.mock('@actions/github', () => ({
  context: {
    payload: {
      pull_request: {
        number: 1,
        base: { sha: 'base-sha' },
        head: { sha: 'head-sha' },
      },
    },
    repo: { owner: 'rudderlabs', repo: 'github-action-check-size-limit' },
  },
  getOctokit: () => ({
    paginate: async (): Promise<unknown[]> => [],
    rest: {
      issues: {
        createComment: async (): Promise<void> => undefined,
        updateComment: async (): Promise<void> => undefined,
      },
    },
  }),
}));

jest.mock('./Term', () => ({
  __esModule: true,
  default: class {
    execSizeLimit(...args: unknown[]) {
      return mockExecSizeLimit(...args);
    }
  },
}));

const resultsOutput = (size: number, sizeLimit: number, passed: boolean) =>
  JSON.stringify([
    {
      name: 'dist/index.js',
      passed,
      size: `${size}`,
      sizeLimit: `${sizeLimit}`,
    },
  ]);

const runAction = async (head: { status: number; output: string }, baseOutput: string) => {
  mockExecSizeLimit.mockResolvedValueOnce(head).mockResolvedValueOnce({ output: baseOutput });

  jest.resetModules();
  await import('./main');
  await new Promise(resolve => setImmediate(resolve));
};

describe('main', () => {
  beforeEach(() => {
    mockGetInput.mockReturnValue('');
  });

  test('should fail with the size limit message when an entry exceeds its limit', async () => {
    await runAction(
      { status: 1, output: resultsOutput(120894, 110000, false) },
      resultsOutput(100894, 110000, true),
    );

    expect(mockSetFailed).toHaveBeenCalledWith('Size limit has been exceeded.');
  });

  test('should fail with the size limit message when a time limit is exceeded', async () => {
    const timeOutput = JSON.stringify([
      {
        name: 'dist/index.js',
        passed: false,
        size: '110894',
        running: '0.1',
        loading: '2.1',
      },
    ]);

    await runAction({ status: 1, output: timeOutput }, timeOutput);

    expect(mockSetFailed).toHaveBeenCalledWith('Size limit has been exceeded.');
  });

  test('should report the exit code when the size script fails without a limit breach', async () => {
    await runAction(
      { status: 127, output: resultsOutput(100894, 110000, true) },
      resultsOutput(100894, 110000, true),
    );

    expect(mockSetFailed).toHaveBeenCalledWith(
      'The size check script failed with exit code 127. No size limit breach was found in its output, check the logs for the actual failure.',
    );
  });

  test('should not fail when the size script succeeds', async () => {
    await runAction(
      { status: 0, output: resultsOutput(100894, 110000, true) },
      resultsOutput(100894, 110000, true),
    );

    expect(mockSetFailed).not.toHaveBeenCalled();
  });
});
