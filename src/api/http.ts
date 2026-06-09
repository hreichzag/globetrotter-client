import type { CallRecord, RequestDescriptor } from '../types';

interface RequestOptions {
  key: string;
  title: string;
  host: string;
  path: string;
  apiKey?: string;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, string>;
  body?: unknown;
}

export async function executeRequest(options: RequestOptions): Promise<CallRecord> {
  const method = options.method ?? 'GET';
  const url = buildUrl(options.host, options.path, options.query);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.apiKey) {
    headers['x-api-key'] = options.apiKey;
  }

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const request: RequestDescriptor = {
    method,
    url,
    headers,
    body: options.body,
  };

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const raw = await response.text();

    return {
      key: options.key,
      title: options.title,
      request,
      response: {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data: parseBody(raw),
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      key: options.key,
      title: options.title,
      request,
      response: {
        ok: false,
        status: 0,
        statusText: 'Network Error',
        data: { message },
      },
      timestamp: new Date().toISOString(),
    };
  }
}

export function buildUrl(host: string, path: string, query?: Record<string, string>): string {
  const normalizedHost = host.replace(/\/+$/, '');
  const fallbackBase = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;

  try {
    const url = new URL(path, normalizedHost || fallbackBase);

    for (const [key, value] of Object.entries(query ?? {})) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  } catch {
    return `${normalizedHost}${path}`;
  }
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export async function executeRecordedRequest(input: { key: string; title: string; request: RequestDescriptor }): Promise<CallRecord> {
  try {
    const response = await fetch(input.request.url, {
      method: input.request.method,
      headers: input.request.headers,
      body: input.request.body === undefined ? undefined : JSON.stringify(input.request.body),
    });
    const raw = await response.text();

    return {
      key: input.key,
      title: input.title,
      request: input.request,
      response: {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data: parseBody(raw),
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      key: input.key,
      title: input.title,
      request: input.request,
      response: {
        ok: false,
        status: 0,
        statusText: 'Network Error',
        data: { message },
      },
      timestamp: new Date().toISOString(),
    };
  }
}

function parseBody(raw: string): unknown {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}
