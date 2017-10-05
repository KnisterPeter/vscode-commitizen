import * as execa from 'execa';
import {join} from 'path';
import * as sander from 'sander';
import * as vscode from 'vscode';
import * as wrap from 'wrap-ansi';

let channel: vscode.OutputChannel;

interface Configuration {
  autoSync: boolean;
  subjectLength: number;
  showOutputChannel: 'off' | 'always' | 'onError';
}

function getConfiguration(): Configuration {
  const config = vscode.workspace.getConfiguration().get<Configuration>('commitizen');
  return config!;
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  channel = vscode.window.createOutputChannel('commitizen');
  channel.appendLine('Commitizen support started');

  const czConfig = await readCzConfig();

  context.subscriptions.push(vscode.commands.registerCommand('vscode-commitizen.commit', async() => {
    const ccm = new ConventionalCommitMessage(czConfig);
    await ccm.getType();
    await ccm.getScope();
    await ccm.getSubject();
    await ccm.getBody();
    await ccm.getBreaking();
    await ccm.getCloses();
    if (ccm.complete && vscode.workspace.workspaceFolders) {
      commit(vscode.workspace.workspaceFolders[0].uri.fsPath, ccm.message.trim());
    }
  }));
}

interface CzConfig {
  types: {
    value: string;
    name: string;
  }[];
  scopes: {
    name?: string;
  }[];
  allowCustomScopes: boolean;
  allowBreakingChanges: string[];
}

async function readCzConfig(): Promise<CzConfig|undefined> {
  const pkg = await readPackageJson();
  if (!pkg) {
    return undefined;
  }
  if (!vscode.workspace.workspaceFolders) {
    return undefined;
  }
  let configPath = join(vscode.workspace.workspaceFolders[0].uri.fsPath, '.cz-config.js');
  if (hasCzConfig(pkg)) {
    configPath = join(vscode.workspace.workspaceFolders[0].uri.fsPath, pkg.config['cz-customizable'].config);
  }
  if (!await sander.exists(configPath)) {
    return undefined;
  }
  return require(configPath) as CzConfig;
}

async function readPackageJson(): Promise<Object|undefined> {
  if (!vscode.workspace.rootPath) {
    return undefined;
  }
  const pkgPath = join(vscode.workspace.rootPath, 'package.json');
  if (!await sander.exists(pkgPath)) {
    return undefined;
  }
  return JSON.parse(await sander.readFile(pkgPath));
}

function hasCzConfig(pkg: any): pkg is { config: { 'cz-customizable': { config: string } } } {
  return pkg.config && pkg.config['cz-customizable'] && pkg.config['cz-customizable'].config;
}

async function askOneOf(question: string, picks: vscode.QuickPickItem[],
    save: (pick: vscode.QuickPickItem) => void): Promise<boolean> {
  const pickOptions: vscode.QuickPickOptions = {
    placeHolder: question,
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true
  };
  const pick = await vscode.window.showQuickPick(picks, pickOptions);
  if (pick === undefined) {
    return false;
  }
  save(pick);
  return true;
}

async function ask(question: string, save: (input: string) => void,
    validate?: (input: string) => string): Promise<boolean> {
  const options: vscode.InputBoxOptions = {
    placeHolder: question,
    ignoreFocusOut: true
  };
  if (validate) {
    options.validateInput = validate;
  }
  const input = await vscode.window.showInputBox(options);
  if (input === undefined) {
    return false;
  }
  save(input);
  return true;
}

const DEFAULT_TYPES = [
  {
    value: 'feat',
    name: 'A new feature'
  },
  {
    value: 'fix',
    name: 'A bug fix'
  },
  {
    value: 'docs',
    name: 'Documentation only changes'
  },
  {
    value: 'style',
    name: 'Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)'
  },
  {
    value: 'refactor',
    name: 'A code change that neither fixes a bug nor adds a feature'
  },
  {
    value: 'perf',
    name: 'A code change that improves performance'
  },
  {
    value: 'test',
    name: 'Adding missing tests or correcting existing tests'
  },
  {
    value: 'build',
    name: 'Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)'
  },
  {
    value: 'ci',
    name: 'Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)'
  },
  {
    value: 'chore',
    name: 'Other changes that don\'t modify src or test files'
  }
];

async function commit(cwd: string, message: string): Promise<void> {
  channel.appendLine(`About to commit '${message}'`);
  try {
    const result = await execa('git', ['commit', '-m', message], {cwd});
    await vscode.commands.executeCommand('git.refresh');
    if (getConfiguration().autoSync) {
      await vscode.commands.executeCommand('git.sync');
    }
    if (hasOutput(result)) {
      result.stdout.split('\n').forEach(line => channel.appendLine(line));
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

function hasOutput(result?: {stdout?: string}): boolean {
  return Boolean(result && result.stdout);
}

function shouldShowOutput(result: {code: number}): boolean {
  return getConfiguration().showOutputChannel === 'always'
    || getConfiguration().showOutputChannel === 'onError' && result.code > 0;
}

class ConventionalCommitMessage {

  private czConfig: CzConfig|undefined;
  private next = true;

  private type: string;
  private scope: string|undefined;
  private subject: string;
  private body: string|undefined;
  private breaking: string|undefined;
  private closes: string|undefined;

  constructor(czConfig: CzConfig|undefined) {
    this.czConfig = czConfig;
  }

  public async getType(): Promise<void> {
    if (this.next) {
      const types = (this.czConfig && this.czConfig.types) || DEFAULT_TYPES;
      const typePicks = types.map(type => ({
        label: type.value,
        description: type.name
      }));
      this.next = await askOneOf('Select the type of change that you\'re committing', typePicks,
        pick => this.type = pick.label);
    }
  }

  private static hasScopes(czConfig: CzConfig|undefined): czConfig is CzConfig {
    return Boolean(czConfig && (!czConfig.allowCustomScopes ||
      czConfig.scopes && czConfig.scopes.length === 0));
  }

  public async getScope(): Promise<void> {
    if (this.next) {
      if (ConventionalCommitMessage.hasScopes(this.czConfig)) {
        if (this.czConfig.scopes && this.czConfig.scopes[0] !== undefined) {
          const scopePicks = this.czConfig.scopes.map(scope => ({
            label: scope.name || scope as string,
            description: ''
          }));
          this.next = await askOneOf('Denote the SCOPE of this change', scopePicks,
            pick => this.scope = pick.label || undefined);
        }
      } else {
        this.next = await ask('Denote the SCOPE of this change (optional)', input => this.scope = input);
      }
    }
  }

  public async getSubject(): Promise<void> {
    if (this.next) {
      const maxLenght = getConfiguration().subjectLength;
      const validator = (input: string) => {
        if (input.length === 0 || input.length > maxLenght) {
          return `Subject is required and must be less than ${maxLenght} characters`;
        }
        return '';
      };
      this.next = await ask('Write a SHORT, IMPERATIVE tense description of the change',
        input => this.subject = input, validator);
    }
  }

  public async getBody(): Promise<void> {
    if (this.next) {
      this.next = await ask('Provide a LONGER description of the change (optional). Use "|" to break new line',
        input => this.body = wrap(input.split('|').join('\n'), 72, {hard: true}));
    }
  }

  public async getBreaking(): Promise<void> {
    if (this.next) {
      this.next = await ask('List any BREAKING CHANGES (optional)', input => this.breaking = input);
    }
  }

  public async getCloses(): Promise<void> {
    if (this.next) {
      this.next = await ask('List any ISSUES CLOSED by this change (optional). E.g.: #31, #34',
        input => this.closes = input);
    }
  }

  public get complete(): boolean {
    return this.next && Boolean(this.type) && Boolean(this.subject);
  }

  public get message(): string {
    // tslint:disable-next-line prefer-template
    return this.type +
      (typeof this.scope === 'string' && this.scope ? `(${this.scope})` : '') +
      `: ${this.subject}\n\n${this.body}\n\n` +
      (this.breaking ? `BREAKING CHANGE: ${this.breaking}\n` : '') +
      (this.closes ? `Closes ${this.closes}` : '');
  }

}
