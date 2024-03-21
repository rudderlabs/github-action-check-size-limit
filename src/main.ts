import { getInput, setFailed } from '@actions/core';
import { context, getOctokit } from '@actions/github';
import { GitHub } from '@actions/github/lib/utils';
import { markdownTable } from 'markdown-table';
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
      // eslint-disable-next-line camelcase
      issue_number: pr.number,
    },
  );

  const sizeLimitComment = commentList.find(comment =>
    (comment as any).body.startsWith(SIZE_LIMIT_HEADING),
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
    const packageManager = getInput('package_manager');
    const directory = getInput('directory') || process.cwd();
    const windowsVerbatimArguments = getInput('windows_verbatim_arguments') === 'true';
    const octokit = getOctokit(token);
    const term = new Term();
    const limit = new SizeLimit();

    const { status, output } = await term.execSizeLimit(
      null,
      skipStep,
      installScript,
      buildScript,
      cleanScript,
      windowsVerbatimArguments,
      directory,
      script,
      packageManager,
      isMonorepo,
    );

    const { output: baseOutput } = await term.execSizeLimit(
      pr.base.ref,
      null,
      installScript,
      buildScript,
      cleanScript,
      windowsVerbatimArguments,
      directory,
      script,
      packageManager,
      isMonorepo,
      pr.head.ref
    );

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
          // eslint-disable-next-line camelcase
          issue_number: pr.number,
          body,
        });
      } catch (error) {
        console.log(
          "Error creating comment. This can happen for PR's originating from a fork without write permissions.",
        );
      }
    } else {
      try {
        await octokit.rest.issues.updateComment({
          ...repo,
          // eslint-disable-next-line camelcase
          comment_id: (sizeLimitComment as any).id,
          body,
        });
      } catch (error) {
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
