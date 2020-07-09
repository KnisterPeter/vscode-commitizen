import { execSync } from 'child_process';
import * as path from 'path';
// tslint:disable-next-line: no-implicit-dependencies
import { runTests } from 'vscode-test';

async function runWorkspace(name: string): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, `./${name}/index`);
    const workspace = path.resolve(
      __dirname,
      `../../src/test/${name}/workspace`
    );

    execSync('yarn install', {
      cwd: workspace
    });

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions', workspace]
    });
  } catch (err) {
    console.error(`Failed to run tests '${name}'`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  await runWorkspace('workspace');
}

main().catch((e) => {
  setImmediate(() => {
    throw e;
  });
});
