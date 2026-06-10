# Globetrotter Booking Integration Guide

## Purpose

This guide explains how a Globetrotter-style client integrates with SmartCapacity `v1` to:

- authenticate with an API key,
- read consultants, skills, availability, and work-location context,
- optionally bootstrap booking-specific custom fields,
- create or update bookings.

## API Docs Links

Integrators can jump straight into published API docs on target tenant host:

- Interactive Scalar docs: `https://<smartcapacity-host>/api/docs`
- OpenAPI JSON (`latest`): `https://<smartcapacity-host>/api/docs/openapi/latest.json`
- OpenAPI JSON (`v1`): `https://<smartcapacity-host>/api/docs/openapi/v1.json`

Recommended usage:

- Open Scalar UI to inspect endpoints and test requests in browser.
- Use `v1.json` for stable integration imports into Postman, Bruno, Insomnia, or generated clients.
- Use `latest.json` only if client intentionally tracks newest non-frozen surface.

## Core Model

There is **no separate booking resource** in SmartCapacity for this integration.

The persisted booking is a **calendar slot** written into the selected consultant's **individual calendar** via:

```text
PATCH /api/v1/calendar/calendars/{calendarId}
```

Read flow and write flow are therefore split like this:

- Read catalog + availability through dedicated REST endpoints.
- Write booking by patching the target calendar's `slots` map.

## Authentication

### Step 1: Create API key

API keys are created from an authenticated user session via:

```text
POST /api/v1/users/me/api-keys
```

Important facts:

- Plaintext `key` is returned **exactly once** in create response.
- Server stores only hashed value.
- Creating key requires user permission `users:security:update`.
- Listing own keys requires `users:profile:read`.

Example:

```http
POST /api/v1/users/me/api-keys
Content-Type: application/json
Cookie: better-auth.session_token=...

{
  "name": "Globetrotter integration",
  "expiresIn": 2592000
}
```

Example response:

```json
{
  "id": "apk_abc123",
  "name": "Globetrotter integration",
  "key": "sk_live_9fE2q7Z6aK1b3X8pT0uVwYrLcDhJmS5n",
  "enabled": true,
  "createdAt": "2026-04-22T09:15:00.000Z"
}
```

### Step 2: Call runtime endpoints with API key

SmartCapacity publishes three auth schemes on versioned API docs:

- `x-api-key: <key>`
- `Authorization: Bearer <key>`
- session cookie auth for browser calls

For server-to-server integration, prefer `x-api-key`. Globetrotter demo currently uses that header.

In Scalar UI at `/api/docs`, integrators can authorize once with the API key and test the runtime endpoints immediately.

Example:

```http
x-api-key: sk_live_9fE2q7Z6aK1b3X8pT0uVwYrLcDhJmS5n
```

## Minimum Permissions

Runtime integration usually needs these permissions on key owner:

| Purpose                                           | Permission         |
| ------------------------------------------------- | ------------------ |
| Read consultants and person work-location         | `employees:read`   |
| Read calendars, availability, assignment metadata | `calendars:read`   |
| Use `needs=shift.*` selectors on availability     | `plans:read`       |
| Read destination skill catalog                    | `skills:read`      |
| Create bookings by patching calendar slots        | `calendars:update` |
| Create/delete booking custom-field definitions    | `settings:update`  |

Recommended split:

- Read-only integration: `employees:read`, `calendars:read`, `plans:read`, optionally `skills:read`
- Booking integration: add `calendars:update`
- Bootstrap/admin automation: add `settings:update`

## End-to-End Sequence

```mermaid
sequenceDiagram
    participant User as Tenant user
    participant GT as Globetrotter client
    participant API as SmartCapacity API v1
    participant CAL as Individual calendar

    User->>API: POST /users/me/api-keys
    API-->>User: plaintext API key (once)

    GT->>API: GET /core/persons?take=100
    GT->>API: GET /core/skills?take=200&skip=0
    GT->>API: GET /core/custom-property-definitions?entityType=calendar-slot
    GT->>API: GET /calendar/availability?...needs=shift.bookable...
    API-->>GT: booking-ready 15-minute slots

    loop for each (personId, date) with available slots
        GT->>API: GET /core/persons/{personId}/locations/work-location?date=YYYY-MM-DD
        API-->>GT: effective work-location entries
    end

    GT->>API: PATCH /calendar/calendars/{calendarId}
    API->>CAL: create slot in consultant calendar
    API-->>GT: updated calendar payload
```

## Read Path

### 1. Load consultants

```text
GET /api/v1/core/persons?take=100
```

Use this as primary consultant catalog.

Relevant facts:

- Permission: `employees:read`
- Response includes person record plus domain enrichments
- Globetrotter demo reads `locations` and `planning.skills` from this payload

Example:

```bash
curl -H "x-api-key: $API_KEY" \
  "$HOST/api/v1/core/persons?take=100"
```

### 2. Load consultant calendars

```text
GET /api/v1/core/persons/{personId}/calendars
```

Use this to find consultant's booking target calendar.

Relevant facts:

- Permission: `employees:read`
- Globetrotter currently picks consultant's `individual` calendar as booking target

### 3. Load skill catalog

```text
GET /api/v1/core/skills?take=200&skip=0
```

Use this when destination/qualification display is needed.

Relevant facts:

- Permission: `skills:read`
- Paginate until `pageInfo.hasMore === false`

### 4. Load booking field definitions

```text
GET /api/v1/core/custom-property-definitions?entityType=calendar-slot
```

Use this to discover which custom properties should be rendered or auto-filled on booking write.

Relevant facts:

- Read access is granted for calendar users; `calendars:read` is sufficient
- Full admin write to definitions requires `settings:update`

### 5. Load booking-ready availability

```text
GET /api/v1/calendar/availability
```

Recommended query pattern used by Globetrotter:

```text
personIds=<comma-separated ids>
from=YYYY-MM-DD
to=YYYY-MM-DD
slotStepMinutes=15
needs=shift.bookable
blockers=absences,meetings,booked-slots,holidays,team-meetings
include=location,categories
```

Relevant facts:

- Permission: `calendars:read`
- If `needs` contains `shift.*`, also requires `plans:read`
- `personIds` max: 50
- Date range max: 92 days
- `slotStepMinutes` must be 5..60 and divide 60
- Response already contains booking-ready slots with resolved `locationId` and derived `categories`

Example:

```bash
curl -H "x-api-key: $API_KEY" \
  "$HOST/api/v1/calendar/availability?personIds=prs_1,prs_2&from=2026-06-01&to=2026-06-30&slotStepMinutes=15&needs=shift.bookable&blockers=absences,meetings,booked-slots,holidays,team-meetings&include=location,categories"
```

Response shape:

```json
{
  "data": [
    {
      "personId": "prs_1",
      "dates": [
        {
          "date": "2026-06-10",
          "slots": [
            {
              "startTime": "09:00",
              "endTime": "09:15",
              "locationId": "loc_zrh",
              "categories": ["On-site"]
            }
          ]
        }
      ]
    }
  ],
  "meta": {
    "from": "2026-06-01",
    "to": "2026-06-30",
    "slotStepMinutes": 15,
    "needs": ["shift.bookable"],
    "blockers": [
      "absences",
      "meetings",
      "booked-slots",
      "holidays",
      "team-meetings"
    ],
    "totalSlots": 1
  }
}
```

### 6. Resolve effective work location per consultant/day

```text
GET /api/v1/core/persons/{personId}/locations/work-location?date=YYYY-MM-DD
```

Use this after availability to confirm consultant's day-specific work location.

Relevant facts:

- Permission: `employees:read`
- Resolution chain is:
  1. location-override slot
  2. recurring work-location template slot
  3. person-location assignment fallback
  4. none
- Endpoint returns `entries[]` with time ranges, so client can pick matching location for specific appointment time
- This is the supported API for work-location resolution; client should not inspect private calendar-slot shapes for this purpose

Example response:

```json
{
  "personId": "prs_abc123",
  "date": "2026-06-02",
  "source": "template",
  "entries": [
    {
      "locationId": "loc_hq",
      "locationName": "HQ Zürich",
      "locationType": "physical",
      "startTime": "08:00",
      "endTime": "17:00"
    }
  ]
}
```

### 7. Optional: load location assignment metadata

```text
GET /api/v1/calendar/assignments/by-location/{locationId}
```

Globetrotter uses this only as metadata support, not as the final day resolver.

Relevant facts:

- Permission: `calendars:read`
- Use only when location-to-calendar linkage metadata is needed

## Write Path

### Optional bootstrap: seed booking custom fields

If client wants SmartCapacity UI to show structured booking fields, create custom property definitions for `calendar-slot`.

Recommended fields used by Globetrotter:

- `customerName` (`text`)
- `phoneNumber` (`text` / phone)
- `emailAddress` (`text` / email)
- `meetingType` (`select`)
- `destinationSkill` (`reference` to `skill`)

Endpoint:

```text
POST /api/v1/core/custom-property-definitions
```

Permission: `settings:update`

### Persist booking

Bookings are created by patching consultant calendar:

```text
PATCH /api/v1/calendar/calendars/{calendarId}
```

Slot update semantics:

- key starts with `new-` => create slot
- key is existing slot UUID => update slot
- key value is `null` => delete slot
- when `slots` object is present, API applies slot mutations and returns updated calendar payload

Example create payload:

```json
{
  "slots": {
    "new-gt-20260610-0900-prs_1": {
      "dateFrom": "2026-06-10",
      "dateTo": null,
      "data": {
        "text": "Beratung",
        "icon": "videocam",
        "isAllDay": false,
        "startTime": "09:00",
        "endTime": "09:15",
        "customProperties": {
          "meetingType": "Video call",
          "destinationSkill": "skl_thailand",
          "emailAddress": "ada@example.com"
        }
      }
    }
  }
}
```

Example call:

```bash
curl -X PATCH \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  "$HOST/api/v1/calendar/calendars/$CALENDAR_ID" \
  -d @booking.json
```

Relevant facts:

- Permission: `calendars:update`
- Booking is stored as calendar slot on consultant calendar
- Slot `customProperties.meetingType` is the source of truth for meeting category
- Slot custom properties are validated against configured `calendar-slot` definitions
- Some properties are conditionally required based on selected `meetingType`

## Entities Read and Written

| Entity                     | Endpoint(s)                                               | Used for                                  | Read/Write                 |
| -------------------------- | --------------------------------------------------------- | ----------------------------------------- | -------------------------- |
| API key                    | `/api/v1/users/me/api-keys`                               | Bootstrap runtime credentials             | Write once, then read/list |
| Person                     | `/api/v1/core/persons`                                    | Consultant catalog                        | Read                       |
| Person calendar            | `/api/v1/core/persons/{personId}/calendars`               | Resolve target calendar for booking       | Read                       |
| Skill                      | `/api/v1/core/skills`                                     | Destination metadata and skill references | Read                       |
| Custom property definition | `/api/v1/core/custom-property-definitions`                | Booking field schema                      | Read and optional write    |
| Availability projection    | `/api/v1/calendar/availability`                           | Bookable 15-minute slots                  | Read                       |
| Work-location resolution   | `/api/v1/core/persons/{personId}/locations/work-location` | Final day/time location context           | Read                       |
| Calendar slot              | `/api/v1/calendar/calendars/{calendarId}`                 | Actual persisted booking                  | Write                      |

## Recommended Integration Pattern

### Bootstrap phase

1. User signs in to SmartCapacity UI.
2. User creates API key.
3. Admin optionally seeds `calendar-slot` custom property definitions.

### Runtime phase

1. Load persons.
2. Load per-person calendars.
3. Load skills and booking field definitions.
4. Query availability with `needs=shift.bookable`.
5. For each available consultant/date, resolve work location.
6. When customer confirms booking, patch consultant individual calendar with new slot.

## Operational Notes

- Use versioned paths only: `/api/v1/...`
- `v1` is URL-versioned; there is no `Accept-Version` header.
- Prefer `x-api-key` for server-to-server requests.
- Availability endpoint is authoritative for slot offer calculation.
- Work-location endpoint is authoritative for day-scoped location resolution.
- Do not infer work location from private slot payloads in client code.
- Bookings are not created through a dedicated `/bookings` endpoint.

## Related Artifact

Visual diagram:

- `docs/diagrams/globetrotter-client-booking-integration.html`

Published API docs on tenant host:

- `https://<smartcapacity-host>/api/docs`
- `https://<smartcapacity-host>/api/docs/openapi/v1.json`
