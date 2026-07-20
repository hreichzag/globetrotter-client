import type { AvailabilityResponse, CustomPropertyDefinition, Person, PersonCalendar, Skill, SkillData, WorkLocationResolution } from '../types';

export function parsePersons(value: unknown): Person[] {
  return readDataArray(value)
    .map(item => ({
      id: readString(item.id),
      firstName: readString(item.firstName),
      lastName: readString(item.lastName),
    }))
    .filter(person => person.id && person.firstName && person.lastName);
}

export function parsePersonCalendars(value: unknown): PersonCalendar[] {
  return readDataArray(value)
    .map(item => ({
      id: readString(item.id),
      name: readString(item.name),
      type: readString(item.type),
    }))
    .filter(calendar => calendar.id && calendar.name);
}

export function parsePersonSkillIds(value: unknown): string[] {
  return readDataArray(value)
    .map(item => readString(item.skillId) || readString(item.id))
    .filter(Boolean);
}

export function parseSkills(value: unknown): Skill[] {
  return readDataArray(value)
    .map(item => ({
      id: readString(item.id),
      name: readString(item.name),
      data: parseSkillData(item.data),
    }))
    .filter(skill => skill.id && skill.name);
}

function parseSkillData(value: unknown): SkillData | null {
  if (!isRecord(value)) return null;
  const cp = isRecord(value.customProperties) ? value.customProperties : null;
  if (!cp) return { customProperties: undefined };
  return {
    customProperties: {
      type: readString(cp['type']) || undefined,
      code: readString(cp['code']) || undefined,
      region: readString(cp['region']) || undefined,
    },
  };
}

export function parseDefinitions(value: unknown): CustomPropertyDefinition[] {
  const definitions = Array.isArray(value) ? value.filter(isRecord) : [];
  return definitions
    .map(item => ({
      id: readString(item.id),
      key: readString(item.key),
      label: readString(item.label),
      propertyType: readString(item.propertyType),
    }))
    .filter(definition => definition.id && definition.key);
}

export function parseAvailability(value: unknown): AvailabilityResponse {
  if (!isRecord(value)) {
    return { data: [] };
  }

  const people = Array.isArray(value.data) ? value.data.filter(isRecord) : [];
  return {
    data: people.map(person => ({
      personId: readString(person.personId),
      dates: readAvailabilityDates(person.dates),
    })),
    meta: isRecord(value.meta)
      ? {
          from: readString(value.meta.from),
          to: readString(value.meta.to),
          slotStepMinutes: readNumber(value.meta.slotStepMinutes),
          needs: readStringArray(value.meta.needs),
          blockers: readStringArray(value.meta.blockers),
          totalSlots: readNumber(value.meta.totalSlots),
        }
      : undefined,
  };
}

export function parseWorkLocation(value: unknown): WorkLocationResolution {
  if (!isRecord(value)) {
    return { date: '', entries: [], personId: '', source: 'none' };
  }

  const entries = Array.isArray(value.entries) ? value.entries.filter(isRecord) : [];
  return {
    personId: readString(value.personId),
    date: readString(value.date),
    source: readString(value.source),
    entries: entries.map(entry => ({
      locationId: readString(entry.locationId),
      locationName: readString(entry.locationName),
      locationType: readNullableString(entry.locationType),
      startTime: readString(entry.startTime),
      endTime: readString(entry.endTime),
    })),
  };
}

export function readAvailabilityDates(value: unknown) {
  const dates = Array.isArray(value) ? value.filter(isRecord) : [];
  return dates.map(dateEntry => ({
    date: readString(dateEntry.date),
    slots: readAvailabilitySlots(dateEntry.slots),
  }));
}

export function readAvailabilitySlots(value: unknown) {
  const slots = Array.isArray(value) ? value.filter(isRecord) : [];
  return slots.map(slot => ({
    startTime: readString(slot.startTime),
    endTime: readString(slot.endTime),
    locationId: readNullableString(slot.locationId),
    categories: readStringArray(slot.categories),
  }));
}

export function readDataArray(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    return [];
  }

  return value.data.filter(isRecord);
}

export function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function readNullableString(value: unknown): string | null {
  if (typeof value === 'string') {
    return value;
  }
  return null;
}

export function readNumber(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

export function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
