export interface Person {
  id: string;
  firstName: string;
  lastName: string;
}

export interface PersonCalendar {
  id: string;
  name: string;
  type: string;
}

export interface SkillCustomProperties {
  type?: string;
  code?: string;
  region?: string;
}

export interface SkillData {
  customProperties?: SkillCustomProperties;
}

export interface Skill {
  id: string;
  name: string;
  data?: SkillData | null;
}

export interface CustomPropertyDefinition {
  id: string;
  key: string;
  label: string;
  propertyType: string;
}

export interface AvailabilitySlot {
  startTime: string;
  endTime: string;
  locationId: string | null;
  categories?: string[];
}

export interface AvailabilityDate {
  date: string;
  slots: AvailabilitySlot[];
}

export interface AvailabilityPerson {
  personId: string;
  dates: AvailabilityDate[];
}

export interface AvailabilityResponse {
  data: AvailabilityPerson[];
  meta?: {
    from: string;
    to: string;
    slotStepMinutes: number;
    needs: string[];
    blockers: string[];
    totalSlots: number;
  };
}

export interface WorkLocationEntry {
  locationId: string;
  locationName: string;
  locationType: string | null;
  startTime: string;
  endTime: string;
}

export interface WorkLocationResolution {
  personId: string;
  date: string;
  source: string;
  entries: WorkLocationEntry[];
}

export interface RequestDescriptor {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

export interface ResponseDescriptor {
  ok: boolean;
  status: number;
  statusText: string;
  data: unknown;
}

export interface CallRecord {
  key: string;
  title: string;
  request: RequestDescriptor;
  response: ResponseDescriptor;
  timestamp: string;
}

export interface ReplayDraft {
  key: string;
  title: string;
  method: string;
  path: string;
  bodyText: string;
}

export interface StoredConfig {
  host: string;
  apiKey: string;
}
