declare module 'execa' {
  import {ExecFileOptions} from 'child_process';

  interface ExecaResult {
    stdout: string;
    stderr: string;
    code: number;
  }

  function execa(command: string, args?: string[], options?: ExecFileOptions): Promise<ExecaResult>;
  namespace execa {
  }
  export = execa;
}
