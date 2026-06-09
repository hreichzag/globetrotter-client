import type { RequestDescriptor } from '../types';
import { isRecord, readString } from './parsers';

export function deriveBookingAttemptKey(request: RequestDescriptor): string | null {
  if (request.method !== 'PATCH') {
    return null;
  }

  const match = request.url.match(/\/api\/v1\/calendar\/calendars\/([^/?#]+)/);
  if (!match) {
    return null;
  }

  const calendarId = decodeURIComponent(match[1]);
  if (!request.body || !isRecord(request.body) || !isRecord(request.body['slots'])) {
    return null;
  }

  const slotEntries = Object.values(request.body['slots']).filter(isRecord);
  if (slotEntries.length !== 1) {
    return null;
  }

  const slot = slotEntries[0];
  const dateFrom = readString(slot['dateFrom']);
  const data = isRecord(slot['data']) ? slot['data'] : null;
  const startTime = data ? readString(data['startTime']) : '';
  if (!calendarId || !dateFrom || !startTime) {
    return null;
  }

  return deriveBookingAttemptKeyFromParts(calendarId, dateFrom, startTime);
}

export function deriveBookingAttemptKeyFromParts(calendarId: string, dateFrom: string, startTime: string): string | null {
  if (!calendarId.trim() || !dateFrom.trim() || !startTime.trim()) {
    return null;
  }

  return `${calendarId.trim()}|${dateFrom.trim()}|${startTime.trim()}`;
}
