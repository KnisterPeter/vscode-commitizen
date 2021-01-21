import * as vscode from 'vscode';
import type { Configuration } from './interfaces/Configuration';

export function getConfiguration(): Configuration {
  const config = vscode.workspace
    .getConfiguration()
    .get<Configuration>('commitizen');
  return config!;
}
