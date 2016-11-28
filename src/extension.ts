import * as vscode from 'vscode';
import * as execa from 'execa';

const types = {
  'feat': 'A new feature',
  'fix': 'A bug fix',
  'docs': 'Documentation only changes',
  'style': 'Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)',
  'refactor': 'A code change that neither fixes a bug nor adds a feature',
  'perf': 'A code change that improves performance',
  'test': 'Adding missing tests or correcting existing tests',
  'build': 'Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)',
  'ci': 'Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)',
  'chore': 'Other changes that don\'t modify src or test files'
};

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(vscode.commands.registerCommand('extension.commit', async () => {
    const typePicks = Object.keys(types).map(feature => ({
      label: feature,
      description: types[feature]
    }))

    let type;
    let scope;
    let subject;
    let body;
    let breaking;
    let closes;
    const pick = await vscode.window.showQuickPick(typePicks, {placeHolder: 'Select the type of change that you\'re committing'})
    if (pick) {
      type = pick.label;
    }
    let next = await ask('Denote the SCOPE of this change (optional)', input => scope = input);
    if (next) {
      next = await askRequired('Write a SHORT, IMPERATIVE tense description of the change', input => subject = input);
    }
    if (next) {
      next = await ask('Provide a LONGER description of the change (optional). Use "|" to break new line', input => body = input.replace('|', '\n'));
    }
    if (next) {
      next = await ask('List any BREAKING CHANGES (optional)', input => breaking = input);
    }
    if (next) {
      next = await ask('List any ISSUES CLOSED by this change (optional). E.g.: #31, #34', input => closes = input);
    }
    if (next) {
      const messsage = type +
        (scope ? `(${scope})` : '') +
        `: ${subject}\n\n${body}\n\n` +
        (breaking ? `BREAKING CHANGE: ${breaking}\n` : '') +
        (closes ? `Closes ${closes}` : '');
      commit(vscode.workspace.rootPath, messsage);
    }
  }));
}

async function ask(question: string, save: (input: string) => void): Promise<boolean> {
  return _ask(false, question, save);
}

async function askRequired(question: string, save: (input: string) => void): Promise<boolean> {
  return _ask(true, question, save);
}

const requiredValidator = (input: string) => {
  if (input.length > 0) {
    return '';
  }
  return 'Value is required';
};
async function _ask(required: boolean, question: string, save: (input: string) => void): Promise<boolean> {
  const options: vscode.InputBoxOptions = {
    placeHolder: question
  };
  if (required) {
    options.validateInput = requiredValidator;
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

export async function commit(cwd: string, message: string): Promise<void> {
  return execa('git', ['commit', '-m', message], {cwd})
    .then(() => {});
}
