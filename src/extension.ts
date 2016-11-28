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
  context.subscriptions.push(vscode.commands.registerCommand('extension.commit', () => {
    const typePicks = Object.keys(types).map(feature => ({
      label: feature,
      description: types[feature]
    }))

    const required = (input: string) => {
      if (input.length > 0) {
        return '';
      }
      return 'Value is required';
    };

    let type;
    let scope;
    let subject;
    let body;
    let breaking;
    let closes;
    vscode.window.showQuickPick(typePicks, {placeHolder: 'Select the type of change that you\'re committing'})
      .then(pick => {
        if (pick) {
          type = pick.label;
        }
      })
      .then(() => vscode.window.showInputBox({placeHolder: 'Denote the SCOPE of this change (optional)'}))
      .then(input => {
        if (input) {
          scope = input;
        }
      })
      .then(() => vscode.window.showInputBox({placeHolder: 'Write a SHORT, IMPERATIVE tense description of the change', validateInput: required}))
      .then(input => {
        if (input) {
          subject = input;
        }
      })
      .then(() => vscode.window.showInputBox({placeHolder: 'Provide a LONGER description of the change (optional). Use "|" to break new line'}))
      .then(input => {
        if (input) {
          body = input.replace('|', '\n');
        }
      })
      .then(() => vscode.window.showInputBox({placeHolder: 'List any BREAKING CHANGES (optional)'}))
      .then(input => {
        if (input) {
          breaking = input;
        }
      })
      .then(() => vscode.window.showInputBox({placeHolder: 'List any ISSUES CLOSED by this change (optional). E.g.: #31, #34'}))
      .then(input => {
        if (input) {
          closes = input;
        }
      })
      .then(() => {
        if (type && subject) {
          const messsage = type +
            (scope ? `(${scope})` : '') +
            `: ${subject}\n\n${body}\n\n` +
            (breaking ? `BREAKING CHANGE: ${breaking}` : '') +
            (closes ? `Closes ${closes}` : '');
          commit(vscode.workspace.rootPath, messsage);
        }
      });
  }));
}

export async function commit(cwd: string, message: string): Promise<void> {
  return execa('git', ['commit', '-m', message], {cwd})
    .then(() => {});
}
