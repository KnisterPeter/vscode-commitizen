export interface CzConfig {
  types: {
    value: string;
    name: string;
  }[];
  scopes: {
    name?: string;
  }[];
  messages: {
    type?: string;
    customScope?: string;
    scope?: string;
    subject?: string;
    body?: string;
    breaking?: string;
    footer?: string;
  };
  allowCustomScopes: boolean;
  allowBreakingChanges: string[];
  footerPrefix: string;
  skipQuestions?: string[];
}
