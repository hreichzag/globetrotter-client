import type { CallRecord, ReplayDraft, RequestDescriptor, StoredConfig } from '../types';
import { buildUrl } from './http';
import { isRecord, readString } from './parsers';
import { STORAGE_KEY } from './constants';

export function readStoredConfig(): StoredConfig {
  if (typeof window === 'undefined') {
    return { host: '', apiKey: '' };
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return { host: '', apiKey: '' };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      return { host: '', apiKey: '' };
    }

    return {
      host: readString(parsed.host),
      apiKey: readString(parsed.apiKey),
    };
  } catch {
    return { host: '', apiKey: '' };
  }
}

export function writeStoredConfig(config: StoredConfig) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function buildScalarOperationUrl(host: string, fragment: string): string {
  return `${buildUrl(host, '/api/docs')}${fragment}`;
}

export function buildReplayRequest(replayDraft: ReplayDraft, host: string, apiKey: string, body: unknown): RequestDescriptor {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (apiKey.trim()) {
    headers['x-api-key'] = apiKey.trim();
  }

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  return {
    method: replayDraft.method,
    url: buildUrl(host, replayDraft.path),
    headers,
    body,
  };
}

export function extractPathFromUrl(fullUrl: string, host: string): string {
  const normalizedHost = host.replace(/\/+$/, '');
  if (fullUrl.startsWith(normalizedHost)) {
    return fullUrl.slice(normalizedHost.length);
  }

  try {
    const parsed = new URL(fullUrl);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fullUrl;
  }
}

export function canRunReadCall(host: string, apiKey: string): boolean {
  return host.trim().length > 0 && apiKey.trim().length > 0;
}

export function findCall(calls: CallRecord[], key: string): CallRecord | null {
  return calls.find(call => call.key === key) ?? null;
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
