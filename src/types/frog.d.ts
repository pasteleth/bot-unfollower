declare module 'frog' {
  export class Frog {
    constructor(options: {
      assetsPath?: string;
      basePath?: string;
      browserLocation?: string;
      [key: string]: any;
    });
    
    frame(path: string, handler: (context: any) => any): void;
  }
}

declare module 'frog/next' {
  export function handle(app: any): (req: any, res: any) => Promise<any>;
}

declare module 'frog/components' {
  export function Button(props: { value: string; children?: any }): any;
  export function TextInput(props: { placeholder?: string }): any;
} 