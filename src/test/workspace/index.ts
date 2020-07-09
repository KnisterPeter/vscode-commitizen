// tslint:disable-next-line: no-implicit-dependencies
import glob from 'glob';
// tslint:disable-next-line: no-implicit-dependencies
import Mocha from 'mocha';
import * as path from 'path';

export async function run(): Promise<void> {
  const mocha = new Mocha({
    color: true,
    timeout: 10 * 1000
  });

  const testsRoot = path.resolve(__dirname);

  return new Promise((resolve, reject) => {
    glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
      if (err) {
        return reject(err);
      }

      files.forEach((f) => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        mocha.run((failures) => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error(err);
        reject(err);
      }
    });
  });
}
