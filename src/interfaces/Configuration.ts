export interface Configuration {
  autoSync: boolean;
  subjectLength: number;
  showOutputChannel: 'off' | 'always' | 'onError';
  quoteMessageInGitCommit: boolean;
  capitalizeWindowsDriveLetter: boolean;
}
