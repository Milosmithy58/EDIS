declare module 'cors' {
  import { RequestHandler } from 'express';

  type CorsOptions = {
    origin?: string | string[];
    methods?: string | string[];
    maxAge?: number;
  } & Record<string, unknown>;

  export default function cors(options?: CorsOptions): RequestHandler;
}

declare module 'etag' {
  export default function etag(entity: string | Buffer, options?: { weak?: boolean }): string;
}
