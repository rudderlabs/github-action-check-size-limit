import { getInput, setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';
import { markdownTable } from 'markdown-table';
import { exec } from '@actions/exec';
import Term from './Term';
import SizeLimit from './SizeLimit';

const SIZE_LIMIT_HEADING = `## size-limit report 📦 `;

async function fetchPreviousComment(
  octokit: InstanceType<typeof GitHub>,
  repo: { owner: string; repo: string },
  pr: { number: number },
) {
  const commentList = await octokit.paginate(
    'GET /repos/:owner/:repo/issues/:issue_number/comments',
    {
      ...repo,

      issue_number: pr.number,
    },
  );

  const sizeLimitComment = commentList.find((comment: { body: string }) =>
    comment.body.startsWith(SIZE_LIMIT_HEADING),
  );
  return !sizeLimitComment ? null : sizeLimitComment;
}

async function run() {
  try {
    const { payload, repo } = context;
    const pr = payload.pull_request;

    if (!pr) {
      throw new Error('No PR found. Only pull_request workflows are supported.');
    }

    const isMonorepo = getInput('is_monorepo') === 'true';
    const token = getInput('github_token');
    const skipStep = getInput('skip_step');
    const installScript = getInput('install_script');
    const buildScript = getInput('build_script');
    const cleanScript = getInput('clean_script');
    const script = getInput('script');
    const directory = getInput('directory') || process.cwd();
    const windowsVerbatimArguments = getInput('windows_verbatim_arguments') === 'true';
    const octokit = getOctokit(token);
    const term = new Term();
    const limit = new SizeLimit();

    const { status, output } = await term.execSizeLimit(
      skipStep,
      installScript,
      buildScript,
      cleanScript,
      windowsVerbatimArguments,
      directory,
      script,
      isMonorepo,
    );

    console.log('Fetching the PR base branch reference', pr.base.sha);
    try {
      await exec(`git fetch origin ${pr.base.sha} --depth=1`);
    } catch (error) {
      console.log('Fetch failed', error.message);
    }

    console.log('Checking out the PR base branch reference', pr.base.sha);
    await exec(`git checkout -f ${pr.base.sha}`);

    const { output: baseOutput } = await term.execSizeLimit(
      null,
      installScript,
      buildScript,
      cleanScript,
      windowsVerbatimArguments,
      directory,
      script,
      isMonorepo,
    );

    console.log('Restoring the PR head reference', pr.head.sha);
    await exec(`git checkout -f ${pr.head.sha}`);

    let base;
    let current;

    try {
      base = limit.parseResults(baseOutput);
      console.log('base', base);
      current = limit.parseResults(output);
      console.log('current', current);
    } catch (error) {
      console.log(
        'Error parsing size-limit output. The output should be a json.',
        baseOutput,
        output,
      );
      throw error;
    }

    const body = [SIZE_LIMIT_HEADING, markdownTable(limit.formatResults(base, current))].join(
      '\r\n',
    );

    const sizeLimitComment = await fetchPreviousComment(octokit, repo, pr);

    if (!sizeLimitComment) {
      try {
        await octokit.rest.issues.createComment({
          ...repo,

          issue_number: pr.number,
          body,
        });
      } catch {
        console.log(
          "Error creating comment. This can happen for PR's originating from a fork without write permissions.",
        );
      }
    } else {
      try {
        await octokit.rest.issues.updateComment({
          ...repo,

          comment_id: (sizeLimitComment as any).id,
          body,
        });
      } catch {
        console.log(
          "Error updating comment. This can happen for PR's originating from a fork without write permissions.",
        );
      }
    }

    if (status > 0) {
      setFailed('Size limit has been exceeded.');
    }
  } catch (error) {
    setFailed(error.message);
  }
}

run();
