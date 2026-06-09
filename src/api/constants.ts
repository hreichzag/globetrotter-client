export const SCALAR_FRAGMENTS = {
  apiKeys: '#v1/tag/profile/POST/api/v1/users/me/api-keys',
  persons: '#v1/tag/persons/GET/api/v1/core/persons',
  personCalendars: '#v1/tag/persons/GET/api/v1/core/persons/{id}/calendars',
  skills: '#v1/tag/skills/GET/api/v1/core/skills',
  customPropertyDefinitions: '#v1/tag/core-custom-property-definitions/GET/api/v1/core/custom-property-definitions',
  availability: '#v1/tag/calendars/GET/api/v1/calendar/availability',
  workLocation: '#v1/tag/person-work-location/GET/api/v1/core/persons/{personId}/locations/work-location',
  bookingWrite: '#v1/tag/calendars/PATCH/api/v1/calendar/calendars/{id}',
} as const;

export const STORAGE_KEY = 'globetrotter-booking-api-demo';
