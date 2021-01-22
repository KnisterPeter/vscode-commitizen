import execa from 'execa';
import { join } from 'path';
import * as sander from 'sander';
// tslint:disable-next-line:no-implicit-dependencies
import * as vscode from 'vscode';
import { ConventionalCommitMessage } from './ConventionalCommitMessage';
import { getConfiguration } from './Helper';
import type { CzConfig } from './interfaces/CzConfig';
import type { GitCmdArgs } from './interfaces/GitCmdArgs';

let channel: vscode.OutputChannel;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  channel = vscode.window.createOutputChannel('commitizen');
  channel.appendLine('Commitizen support started');

  const czConfig = await readCzConfig();

  context.subscriptions.push(
    vscode.commands.registerCommand('vscode-commitizen.commit', async () => {
      const ccm = new ConventionalCommitMessage(czConfig);
      await ccm.getType();
      await ccm.getScope();
      await ccm.getSubject();
      await ccm.getBody();
      await ccm.getBreaking();
      await ccm.getFooter();
      if (ccm.complete && vscode.workspace.workspaceFolders) {
        await commit(
          vscode.workspace.workspaceFolders[0].uri.fsPath,
          ccm.message.trim()
        );
      }
    })
  );
}

async function readCzConfig(): Promise<CzConfig | undefined> {
  if (!vscode.workspace.workspaceFolders) {
    return undefined;
  }
  let configPath = join(
    vscode.workspace.workspaceFolders[0].uri.fsPath,
    '.cz-config.js'
  );
  if (await sander.exists(configPath)) {
    return require(configPath) as CzConfig;
  }
  const pkg = await readPackageJson();
  if (!pkg) {
    return undefined;
  }
  configPath = join(
    vscode.workspace.workspaceFolders[0].uri.fsPath,
    '.cz-config.js'
  );
  if (hasCzConfig(pkg)) {
    configPath = join(
      vscode.workspace.workspaceFolders[0].uri.fsPath,
      pkg.config['cz-customizable'].config
    );
  }
  if (!(await sander.exists(configPath))) {
    return undefined;
  }
  return require(configPath) as CzConfig;
}

async function readPackageJson(): Promise<object | undefined> {
  if (!vscode.workspace.workspaceFolders) {
    return undefined;
  }
  const pkgPath = join(
    vscode.workspace.workspaceFolders[0].uri.fsPath,
    'package.json'
  );
  if (!(await sander.exists(pkgPath))) {
    return undefined;
  }
  return JSON.parse(await sander.readFile(pkgPath));
}

function hasCzConfig(
  pkg: any
): pkg is { config: { 'cz-customizable': { config: string } } } {
  return (
    pkg.config &&
    pkg.config['cz-customizable'] &&
    pkg.config['cz-customizable'].config
  );
}

function capitalizeWindowsDriveLetter(path: string): string {
  if (!path) {
    return path;
  }

  return path.replace(/(\w+?):/, (rootElement) => {
    return rootElement.toUpperCase();
  });
}

async function commit(cwd: string, message: string): Promise<void> {
  const gitCmdArgs = getGitCmdArgs(message, cwd);

  channel.appendLine(`About to commit '${gitCmdArgs.message}'`);

  try {
    await conditionallyStageFiles(cwd);
    const result = await execa('git', ['commit', '-m', gitCmdArgs.message], {
      cwd: gitCmdArgs.cwd,
      preferLocal: false,
      shell: true
    });
    await vscode.commands.executeCommand('git.refresh');
    if (getConfiguration().autoSync) {
      await vscode.commands.executeCommand('git.sync');
    }
    if (hasOutput(result)) {
      result.stdout.split('\n').forEach((line) => channel.appendLine(line));
      if (shouldShowOutput(result)) {
        channel.show();
      }
    }
  } catch (e) {
    vscode.window.showErrorMessage(e.message);
    channel.appendLine(e.message);
    channel.appendLine(e.stack);
  }
}

function hasOutput(result?: { stdout?: string }): boolean {
  return Boolean(result && result.stdout);
}

function shouldShowOutput(result: { exitCode: number }): boolean {
  return (
    getConfiguration().showOutputChannel === 'always' ||
    (getConfiguration().showOutputChannel === 'onError' && result.exitCode > 0)
  );
}

async function conditionallyStageFiles(cwd: string): Promise<void> {
  const hasSmartCommitEnabled =
    vscode.workspace
      .getConfiguration('git')
      .get<boolean>('enableSmartCommit') === true;

  if (hasSmartCommitEnabled && !(await hasStagedFiles(cwd))) {
    channel.appendLine(
      'Staging all files (enableSmartCommit enabled with nothing staged)'
    );
    await vscode.commands.executeCommand('git.stageAll');
  }
}

async function hasStagedFiles(cwd: string): Promise<boolean> {
  const result = await execa('git', ['diff', '--name-only', '--cached'], {
    cwd
  });
  return hasOutput(result);
}

function getGitCmdArgs(message: string, cwd: string): GitCmdArgs {
  let messageForGit = message;

  if (getConfiguration().quoteMessageInGitCommit) {
    messageForGit = `"${message}"`;
  }
  let cwdForGit = cwd;

  if (getConfiguration().capitalizeWindowsDriveLetter) {
    cwdForGit = capitalizeWindowsDriveLetter(cwd);
  }

  return {
    message: messageForGit,
    cwd: cwdForGit
  };
}
