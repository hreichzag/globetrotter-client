# Globetrotter Booking API Demo

Minimal standalone React app for StackBlitz.

Purpose:

- configure SmartCapacity API host + API key,
- inspect Globetrotter-specific REST calls,
- execute read calls,
- preview and optionally send booking write call.

## Run

```bash
npm install
npm run dev
```

## Move to StackBlitz

Copy this whole folder into a new StackBlitz project.

## Included endpoint flow

1. `POST /api/v1/users/me/api-keys` (explained, not executed from API key flow)
2. `GET /api/v1/core/persons?take=100`
3. `GET /api/v1/core/persons/{personId}/calendars`
4. `GET /api/v1/core/skills?take=200&skip=0`
5. `GET /api/v1/core/custom-property-definitions?entityType=calendar-slot`
6. `GET /api/v1/calendar/availability?...`
7. `GET /api/v1/core/persons/{personId}/locations/work-location?date=YYYY-MM-DD`
8. `PATCH /api/v1/calendar/calendars/{calendarId}`
