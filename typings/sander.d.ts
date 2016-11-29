declare module 'sander' {
  export function readFile(path: string): Promise<string>;
  export function exists(path: string): Promise<boolean>;
}
