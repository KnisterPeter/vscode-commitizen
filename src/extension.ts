import * as execa from 'execa';
import {join} from 'path';
import * as sander from 'sander';
import * as vscode from 'vscode';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const czConfig = await readCzConfig();

  context.subscriptions.push(vscode.commands.registerCommand('extension.commit', async () => {
    const ccm = new ConventionalCommitMessage(czConfig);
    await ccm.getType();
    await ccm.getScope();
    await ccm.getSubject();
    await ccm.getBody();
    await ccm.getBreaking();
    await ccm.getCloses();
    if (ccm.complete) {
      commit(vscode.workspace.rootPath, ccm.message);
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
  if (vscode.workspace.rootPath) {
    const pkg = JSON.parse(await sander.readFile(join(vscode.workspace.rootPath, 'package.json')));
    let configPath = join(vscode.workspace.rootPath, '.cz-config.js');
    if (pkg.config && pkg.config['cz-customizable'] && pkg.config['cz-customizable'].config) {
      configPath = join(vscode.workspace.rootPath, pkg.config['cz-customizable'].config);
    }
    if (await sander.exists(configPath)) {
      return require(configPath) as CzConfig;
    }
  }
  return undefined;
}

async function askOneOf(question: string, picks: vscode.QuickPickItem[],
    save: (pick: vscode.QuickPickItem) => void): Promise<boolean> {
  const pick = await vscode.window.showQuickPick(picks, {placeHolder: question});
  if (pick === undefined) {
    return false;
  }
  save(pick);
  return true;
}

async function ask(question: string, save: (input: string) => void,
    validate?: (input: string) => string): Promise<boolean> {
  const options: vscode.InputBoxOptions = {
    placeHolder: question
  };
  if (validate) {
    options.validateInput = validate;
  }
  return vscode.window.showInputBox(options)
    .then(input => {
      if (input === undefined) {
        return false;
      }
      save(input);
      return true;
    });
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
  return execa('git', ['commit', '-m', message], {cwd})
    .then(() => {
      //
    });
}

class ConventionalCommitMessage {

  private czConfig: CzConfig|undefined;
  private next: boolean = true;

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

  public async getScope(): Promise<void> {
    if (this.next) {
      if (this.czConfig && (!this.czConfig.allowCustomScopes || this.czConfig.scopes.length === 0)) {
        if (this.czConfig.scopes[0].name !== undefined) {
          const scopePicks = this.czConfig.scopes.map(scope => ({
            label: scope.name as string,
            description: ''
          }));
          this.next = await askOneOf('Denote the SCOPE of this change', scopePicks, pick => this.scope = pick.label);
        }
      } else {
        this.next = await ask('Denote the SCOPE of this change (optional)', input => this.scope = input);
      }
    }
  }

  public async getSubject(): Promise<void> {
    if (this.next) {
      const validator = (input: string) => {
        if (input.length === 0 || input.length > 50) {
          return 'Subject is required and must be less than 50 characters';
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
        input => this.body = input.replace('|', '\n'));
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
    return this.type +
      (this.scope ? `(${this.scope})` : '') +
      `: ${this.subject}\n\n${this.body}\n\n` +
      (this.breaking ? `BREAKING CHANGE: ${this.breaking}\n` : '') +
      (this.closes ? `Closes ${this.closes}` : '');
  }

}
