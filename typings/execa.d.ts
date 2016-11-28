declare module 'execa' {
  import {ExecFileOptions} from 'child_process';

  function execa(command: string, args?: string[], options?: ExecFileOptions): Promise<{stdout: string, stderr: string}>;
  namespace execa {
  }
  export = execa;
}
