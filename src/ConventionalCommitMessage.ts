import * as vscode from 'vscode';
import wrap from 'wrap-ansi';
import { getConfiguration } from './Helper';
import type { CzConfig } from './interfaces/CzConfig';

export class ConventionalCommitMessage {
  private readonly DEFAULT_TYPES = [
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
      name:
        'Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)'
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
      name:
        'Changes that affect the build system or external dependencies (example scopes: gulp, broccoli, npm)'
    },
    {
      value: 'ci',
      name:
        'Changes to our CI configuration files and scripts (example scopes: Travis, Circle, BrowserStack, SauceLabs)'
    },
    {
      value: 'chore',
      name: "Other changes that don't modify src or test files"
    }
  ];

  private readonly DEFAULT_MESSAGES = {
    type: "Select the type of change that you're committing",
    customScope: 'Denote the SCOPE of this change',
    customScopeEntry: 'Custom scope...',
    scope: 'Denote the SCOPE of this change (optional)',
    subject: 'Write a SHORT, IMPERATIVE tense description of the change',
    body:
      'Provide a LONGER description of the change (optional). Use "|" to break new line',
    breaking: 'List any BREAKING CHANGES (optional)',
    footer: 'List any ISSUES CLOSED by this change (optional). E.g.: #31, #34'
  };

  private readonly czConfig: CzConfig | undefined;
  private next = true;

  private type?: string;
  private scope: string | undefined;
  private subject?: string;
  private body: string | undefined;
  private breaking: string | undefined;
  private footer: string | undefined;

  constructor(czConfig: CzConfig | undefined) {
    this.czConfig = czConfig;
  }

  public async getType(): Promise<void> {
    if (this.next) {
      const types =
        (this.czConfig && this.czConfig.types) || this.DEFAULT_TYPES;
      const typePicks = types.map((type) => ({
        label: type.value,
        description: type.name
      }));
      this.next = await this.askOneOf(
        this.inputMessage('type'),
        typePicks,
        (pick) => (this.type = pick.label)
      );
    }
  }

  public async getScope(): Promise<void> {
    if (this.next) {
      if (this.hasScopes(this.czConfig)) {
        if (this.czConfig.scopes && this.czConfig.scopes[0] !== undefined) {
          const scopePicks = this.getScopePicks(
            this.czConfig,
            this.inputMessage('customScopeEntry')
          );
          this.next = await this.askOneOf(
            this.inputMessage('customScope'),
            scopePicks,
            (pick) => {
              this.scope = pick.label || undefined;
            },
            this.inputMessage('customScopeEntry'),
            this.inputMessage('customScope')
          );
        }
      } else if (!this.shouldSkip(this.czConfig, 'scope')) {
        this.next = await this.ask(
          this.inputMessage('scope'),
          (input) => (this.scope = input)
        );
      }
    }
  }

  public async getSubject(): Promise<void> {
    if (this.next) {
      const maxLength = getConfiguration().subjectLength;
      const validator = (input: string) => {
        if (input.length === 0 || input.length > maxLength) {
          return `Subject is required and must be less than ${maxLength} characters`;
        }
        return '';
      };
      this.next = await this.ask(
        this.inputMessage('subject'),
        (input) => (this.subject = input),
        validator
      );
    }
  }

  public async getBody(): Promise<void> {
    if (this.next && !this.shouldSkip(this.czConfig, 'body')) {
      this.next = await this.ask(
        this.inputMessage('body'),
        (input) =>
          (this.body = wrap(input.split('|').join('\n'), 72, { hard: true }))
      );
    }
  }

  public async getBreaking(): Promise<void> {
    if (
      this.next &&
      !this.shouldSkip(this.czConfig, 'breaking') &&
      this.allowBreakingChanges()
    ) {
      this.next = await this.ask(
        this.inputMessage('breaking'),
        (input) => (this.breaking = input)
      );
    }
  }

  public async getFooter(): Promise<void> {
    if (this.next && !this.shouldSkip(this.czConfig, 'footer')) {
      this.next = await this.ask(
        this.inputMessage('footer'),
        (input) => (this.footer = input)
      );
    }
  }

  public get complete(): boolean {
    return this.next && Boolean(this.type) && Boolean(this.subject);
  }

  public get message(): string {
    return (
      // tslint:disable-next-line: prefer-template
      this.type +
      (typeof this.scope === 'string' && this.scope ? `(${this.scope})` : '') +
      `: ${this.subject}\n\n${this.body}\n\n` +
      (this.breaking ? `BREAKING CHANGE: ${this.breaking}\n` : '') +
      this.messageFooter()
    );
  }

  private shouldSkip(
    czConfig: CzConfig | undefined,
    messageType: string
  ): czConfig is CzConfig {
    return Boolean(
      czConfig &&
        czConfig.skipQuestions &&
        czConfig.skipQuestions.includes(messageType)
    );
  }

  private hasScopes(czConfig: CzConfig | undefined): czConfig is CzConfig {
    return Boolean(czConfig && czConfig.scopes && czConfig.scopes.length !== 0);
  }

  private hasCustomMessage(
    czConfig: CzConfig | undefined,
    messageType: string
  ): czConfig is CzConfig {
    return Boolean(
      czConfig &&
        czConfig.messages &&
        czConfig.messages.hasOwnProperty(messageType)
    );
  }

  private getScopePicks(
    czConfig: CzConfig,
    allowCustomScopesLabel: string
  ): { label: string; description: string }[] {
    const scopePicks = czConfig.scopes.map((scope) => ({
      label: scope.name || (scope as string),
      description: ''
    }));
    if (czConfig.allowCustomScopes) {
      scopePicks.push({
        label: allowCustomScopesLabel,
        description: ''
      });
    }
    return scopePicks;
  }

  private messageFooter(): string {
    return this.footer
      ? `${
          this.czConfig && this.czConfig.footerPrefix
            ? this.czConfig.footerPrefix
            : 'Closes '
        }${this.footer}`
      : '';
  }

  private inputMessage(messageType: string): string {
    return this.hasCustomMessage(this.czConfig, messageType)
      ? this.czConfig.messages[messageType]
      : this.DEFAULT_MESSAGES[messageType];
  }

  private async askOneOf(
    question: string,
    picks: vscode.QuickPickItem[],
    save: (pick: vscode.QuickPickItem) => void,
    customLabel?: string,
    customQuestion?: string
  ): Promise<boolean> {
    const pickOptions: vscode.QuickPickOptions = {
      placeHolder: question,
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    };
    const pick = await vscode.window.showQuickPick(picks, pickOptions);
    if (pick && pick.label === customLabel && !!customQuestion) {
      const next = await this.ask(customQuestion || '', (input) => {
        save({ label: input, description: '' });
        return true;
      });
      return next;
    }
    if (pick === undefined) {
      return false;
    }
    save(pick);
    return true;
  }

  private async ask(
    question: string,
    save: (input: string) => void,
    validate?: (input: string) => string
  ): Promise<boolean> {
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

  private allowBreakingChanges(): boolean {
    if (this.czConfig?.allowBreakingChanges && this.type) {
      return this.czConfig?.allowBreakingChanges.some(
        (type: string) => type === this.type
      );
    }

    return false;
  }
}
