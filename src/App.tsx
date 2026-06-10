import { useEffect, useMemo, useState } from 'react';
import {
  buildBookingPayload,
  buildReplayRequest,
  buildScalarOperationUrl,
  buildUrl,
  canRunReadCall,
  deriveBookingAttemptKey,
  deriveBookingAttemptKeyFromParts,
  executeRecordedRequest,
  executeRequest,
  extractPathFromUrl,
  findCall,
  formatJson,
  getAvailableBookingTimes,
  getAvailableCategoriesForSlot,
  parseAvailability,
  parseDefinitions,
  parsePersonCalendars,
  parsePersons,
  parseSkills,
  parseWorkLocation,
  readStoredConfig,
  SCALAR_FRAGMENTS,
  todayIso,
  addDaysIso,
  writeStoredConfig,
} from './api';
import type { BookingCategory } from './api';
import { CallHistoryCard, EndpointCard, InfoCard, ReplayDialog } from './components';
import type {
  AvailabilityResponse,
  CallRecord,
  CustomPropertyDefinition,
  Person,
  PersonCalendar,
  ResponseDescriptor,
  ReplayDraft,
  Skill,
  WorkLocationResolution,
} from './types';

export function App() {
  const storedConfig = readStoredConfig();
  const [host, setHost] = useState(storedConfig.host || 'http://localhost:3000');
  const [apiKey, setApiKey] = useState(storedConfig.apiKey || '');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);

  const [persons, setPersons] = useState<Person[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [definitions, setDefinitions] = useState<CustomPropertyDefinition[]>([]);
  const [personCalendars, setPersonCalendars] = useState<PersonCalendar[]>([]);
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [workLocation, setWorkLocation] = useState<WorkLocationResolution | null>(null);

  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [availabilityPersonIds, setAvailabilityPersonIds] = useState('');
  const [fromDate, setFromDate] = useState(todayIso());
  const [toDate, setToDate] = useState(addDaysIso(todayIso(), 14));
  const [workLocationDate, setWorkLocationDate] = useState(todayIso());

  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const [bookingDate, setBookingDate] = useState(todayIso());
  const [bookingTime, setBookingTime] = useState('09:00');
  const [bookingCategory, setBookingCategory] = useState<BookingCategory>('Video call');
  const [customerName, setCustomerName] = useState('Ada Lovelace');
  const [emailAddress, setEmailAddress] = useState('ada@example.com');
  const [phoneNumber, setPhoneNumber] = useState('+41 79 000 00 00');
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [successfulBookingKeys, setSuccessfulBookingKeys] = useState<Set<string>>(new Set());
  const [blockedBookingKeys, setBlockedBookingKeys] = useState<Set<string>>(new Set());
  const [replayDraft, setReplayDraft] = useState<ReplayDraft | null>(null);
  const [replayBusy, setReplayBusy] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  useEffect(() => {
    // Extract and validate apiHost from query parameters
    const params = new URLSearchParams(window.location.search);
    let apiHostValue = params.get('apiHost');

    if (!apiHostValue) {
      return;
    }

    // Try to decode if it looks like base64
    try {
      if (/^[A-Za-z0-9+/]*={0,2}$/.test(apiHostValue)) {
        const decoded = atob(apiHostValue);
        // Verify it decoded to something that looks like a URL
        if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
          apiHostValue = decoded;
        }
      }
    } catch {
      // If decoding fails, just use the original value
    }

    // Validate URL
    try {
      new URL(apiHostValue);
      setHost(apiHostValue);
    } catch {
      // Invalid URL, ignore silently
    }
  }, []);

  useEffect(() => {
    writeStoredConfig({ host, apiKey });
  }, [apiKey, host]);

  const interactiveDocsUrl = buildUrl(host, '/api/docs#v1');
  const v1JsonUrl = buildUrl(host, '/api/docs/openapi/v1.json');
  const selectedSkillName = useMemo(() => skills.find(skill => skill.id === selectedSkillId)?.name ?? '', [selectedSkillId, skills]);

  const bookingPayload = buildBookingPayload({
    bookingCategory,
    bookingDate,
    bookingTime,
    customerName,
    emailAddress,
    phoneNumber,
    selectedSkillId,
    selectedSkillName,
  });

  const currentBookingAttemptKey = deriveBookingAttemptKeyFromParts(selectedCalendarId, bookingDate, bookingTime);
  const alreadyBookedLocally = currentBookingAttemptKey ? successfulBookingKeys.has(currentBookingAttemptKey) : false;
  const blockedBookingLocally = currentBookingAttemptKey ? blockedBookingKeys.has(currentBookingAttemptKey) : false;
  const availableBookingTimes = useMemo(
    () => getAvailableBookingTimes(availability, selectedPersonId, bookingDate),
    [availability, bookingDate, selectedPersonId]
  );

  const availableCategories = useMemo(
    () => getAvailableCategoriesForSlot(availability, selectedPersonId, bookingDate, bookingTime),
    [availability, bookingDate, bookingTime, selectedPersonId]
  );

  useEffect(() => {
    if (availableBookingTimes.length === 0) {
      setBookingTime('');
      return;
    }

    if (!availableBookingTimes.includes(bookingTime)) {
      setBookingTime(availableBookingTimes[0]);
    }
  }, [availableBookingTimes, bookingTime]);

  useEffect(() => {
    if (availableCategories.length > 0 && !availableCategories.includes(bookingCategory)) {
      setBookingCategory(availableCategories[0]);
    }
  }, [availableCategories, bookingCategory]);

  async function runPersonsCall() {
    const record = await runCall({
      key: 'persons',
      title: 'List consultants',
      path: '/api/v1/core/persons',
      query: { take: '100' },
    });

    if (record.response.ok) {
      const nextPersons = parsePersons(record.response.data);
      setPersons(nextPersons);
      if (!selectedPersonId && nextPersons[0]) {
        setSelectedPersonId(nextPersons[0].id);
      }
      if (!availabilityPersonIds && nextPersons.length > 0) {
        setAvailabilityPersonIds(
          nextPersons
            .slice(0, 3)
            .map(person => person.id)
            .join(',')
        );
      }
    }
  }

  async function runCalendarsCall() {
    if (!selectedPersonId) {
      return;
    }

    const record = await runCall({
      key: 'person-calendars',
      title: 'List consultant calendars',
      path: `/api/v1/core/persons/${selectedPersonId}/calendars`,
    });

    if (record.response.ok) {
      const nextCalendars = parsePersonCalendars(record.response.data);
      setPersonCalendars(nextCalendars);
      const defaultCalendar = nextCalendars.find(calendar => calendar.type === 'individual') ?? nextCalendars[0];
      if (defaultCalendar) {
        setSelectedCalendarId(defaultCalendar.id);
      }
    }
  }

  async function runSkillsCall() {
    const record = await runCall({
      key: 'skills',
      title: 'List destination skills',
      path: '/api/v1/core/skills',
      query: { take: '200', skip: '0' },
    });

    if (record.response.ok) {
      const nextSkills = parseSkills(record.response.data);
      setSkills(nextSkills);
      if (!selectedSkillId && nextSkills[0]) {
        setSelectedSkillId(nextSkills[0].id);
      }
    }
  }

  async function runDefinitionsCall() {
    const record = await runCall({
      key: 'custom-property-definitions',
      title: 'List booking custom fields',
      path: '/api/v1/core/custom-property-definitions',
      query: { entityType: 'calendar-slot' },
    });

    if (record.response.ok) {
      setDefinitions(parseDefinitions(record.response.data));
    }
  }

  async function runAvailabilityCall() {
    const personIds = availabilityPersonIds
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)
      .join(',');

    if (!personIds) {
      return;
    }

    const record = await runCall({
      key: 'availability',
      title: 'Query booking-ready availability',
      path: '/api/v1/calendar/availability',
      query: {
        personIds,
        from: fromDate,
        to: toDate,
        slotStepMinutes: '15',
        needs: 'shift.bookable',
        blockers: 'absences,meetings,booked-slots,holidays,team-meetings',
        include: 'location,categories',
      },
    });

    if (record.response.ok) {
      setAvailability(parseAvailability(record.response.data));
    }
  }

  async function runWorkLocationCall() {
    if (!selectedPersonId) {
      return;
    }

    const record = await runCall({
      key: 'work-location',
      title: 'Resolve work location for person/date',
      path: `/api/v1/core/persons/${selectedPersonId}/locations/work-location`,
      query: { date: workLocationDate },
    });

    if (record.response.ok) {
      setWorkLocation(parseWorkLocation(record.response.data));
    }
  }

  async function runBookingCall() {
    if (!selectedCalendarId) {
      return;
    }

    if (alreadyBookedLocally) {
      setBookingError('Client blocked this request. This calendar slot was already booked successfully in this demo session.');
      return;
    }

    if (blockedBookingLocally) {
      setBookingError('Client blocked this request. A previous attempt for this calendar/date/time failed due to conflict or unavailable slot.');
      return;
    }

    if (selectedPersonId) {
      const preflightAvailabilityRecord = await runCall({
        key: 'booking-preflight-availability',
        title: 'Preflight availability check before booking',
        path: '/api/v1/calendar/availability',
        query: {
          personIds: selectedPersonId,
          from: bookingDate,
          to: bookingDate,
          slotStepMinutes: '15',
          needs: 'shift.bookable',
          blockers: 'absences,meetings,booked-slots,holidays,team-meetings',
          include: 'location,categories',
        },
      });

      if (preflightAvailabilityRecord.response.ok) {
        const freshAvailability = parseAvailability(preflightAvailabilityRecord.response.data);
        setAvailability(freshAvailability);

        const freshBookingTimes = getAvailableBookingTimes(freshAvailability, selectedPersonId, bookingDate);
        if (!freshBookingTimes.includes(bookingTime)) {
          setBookingError('This slot is no longer available according to fresh availability data. Please choose another time.');
          if (currentBookingAttemptKey) {
            setBlockedBookingKeys(existing => new Set(existing).add(currentBookingAttemptKey));
          }
          return;
        }
      }
    }

    setBookingError(null);
    const record = await runCall({
      key: 'booking-write',
      title: 'Create booking slot',
      path: `/api/v1/calendar/calendars/${selectedCalendarId}`,
      method: 'PATCH',
      body: bookingPayload,
    });

    if (!record.response.ok && currentBookingAttemptKey && isConflictOrUnavailable(record.response)) {
      setBlockedBookingKeys(existing => new Set(existing).add(currentBookingAttemptKey));
    }
  }

  async function runCall(options: {
    key: string;
    title: string;
    path: string;
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    query?: Record<string, string>;
    body?: unknown;
  }) {
    setBusyKey(options.key);
    const record = await executeRequest({
      apiKey,
      body: options.body,
      host,
      key: options.key,
      method: options.method,
      path: options.path,
      query: options.query,
      title: options.title,
    });
    rememberCall(record);
    setBusyKey(null);
    return record;
  }

  function rememberCall(record: CallRecord) {
    setCalls(existing =>
      [record, ...existing.filter(item => item.key !== record.key)].sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    );
    const replayBookingKey = deriveBookingAttemptKey(record.request);
    if (record.response.ok && replayBookingKey) {
      setSuccessfulBookingKeys(existing => new Set(existing).add(replayBookingKey));
    }
  }

  function openReplayDialog(call: CallRecord) {
    setReplayError(null);
    setReplayDraft({
      key: call.key,
      title: call.title,
      method: call.request.method,
      path: extractPathFromUrl(call.request.url, host),
      bodyText: call.request.body === undefined ? '' : formatJson(call.request.body),
    });
  }

  function closeReplayDialog() {
    if (replayBusy) {
      return;
    }
    setReplayDraft(null);
    setReplayError(null);
  }

  async function submitReplayDialog() {
    if (!replayDraft) {
      return;
    }

    let parsedBody: unknown = undefined;
    if (replayDraft.bodyText.trim()) {
      try {
        parsedBody = JSON.parse(replayDraft.bodyText) as unknown;
      } catch {
        setReplayError('Request body must be valid JSON.');
        return;
      }
    }

    const request = buildReplayRequest(replayDraft, host, apiKey, parsedBody);
    const duplicateBookingKey = deriveBookingAttemptKey(request);
    if (duplicateBookingKey && successfulBookingKeys.has(duplicateBookingKey)) {
      setReplayError('Client blocked this replay. This calendar slot was already booked successfully in this demo session.');
      return;
    }

    setReplayBusy(true);
    setReplayError(null);
    const record = await executeRecordedRequest({
      key: replayDraft.key,
      title: replayDraft.title,
      request,
    });
    rememberCall(record);
    setReplayBusy(false);
    setReplayDraft(null);
  }

  function isConflictOrUnavailable(response: ResponseDescriptor): boolean {
    if (response.status === 409 || response.status === 422) {
      return true;
    }

    const responseText = stringifyResponseData(response.data).toLowerCase();
    return (
      responseText.includes('conflict') ||
      responseText.includes('not available') ||
      responseText.includes('unavailable') ||
      responseText.includes('already booked')
    );
  }

  function stringifyResponseData(data: unknown): string {
    if (typeof data === 'string') {
      return data;
    }

    if (data === null || data === undefined) {
      return '';
    }

    try {
      return JSON.stringify(data);
    } catch {
      return '';
    }
  }

  return (
    <div className="page-shell">
      <header className="hero-card">
        <p className="eyebrow">StackBlitz-ready React example</p>
        <h1>Globetrotter Booking API Demo</h1>
        <p className="hero-copy">
          Small React app for integrators. Configure SmartCapacity host + API key, run Globetrotter-specific REST calls, inspect
          request/response payloads, and preview booking write body.
        </p>

        <div className="config-grid">
          <label className="field-block">
            <span>API host</span>
            <input value={host} onChange={event => setHost(event.target.value)} placeholder="https://tenant.smartcapacity.example" />
          </label>
          <label className="field-block">
            <span>API key</span>
            <input value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="sk_live_..." type="password" />
          </label>
        </div>

        <div className="docs-links">
          <a href={interactiveDocsUrl} rel="noreferrer" target="_blank">
            Open Scalar docs
          </a>
          <a href={v1JsonUrl} rel="noreferrer" target="_blank">
            Open OpenAPI v1 JSON
          </a>
        </div>
      </header>

      <main className="content-grid">
        <section className="cards-column">
          <EndpointCard
            codeSample={`POST /api/v1/users/me/api-keys\nCookie: better-auth.session_token=...\n\n{\n  "name": "Globetrotter integration",\n  "expiresIn": 2592000\n}`}
            docsUrl={buildScalarOperationUrl(host, SCALAR_FRAGMENTS.apiKeys)}
            endpoint="POST /api/v1/users/me/api-keys"
            method="POST"
            permission="users:security:update"
            title="1. Create API key"
          >
            This call is part of bootstrap flow. It needs an authenticated SmartCapacity user session, so this demo explains it but does not
            execute it with API key.
          </EndpointCard>

          <EndpointCard
            action={
              <button className="action-button" disabled={!canRunReadCall(host, apiKey) || busyKey === 'persons'} onClick={runPersonsCall}>
                {busyKey === 'persons' ? 'Loading...' : 'Run call'}
              </button>
            }
            docsUrl={buildScalarOperationUrl(host, SCALAR_FRAGMENTS.persons)}
            endpoint="GET /api/v1/core/persons?take=100"
            latestCall={findCall(calls, 'persons')}
            method="GET"
            permission="employees:read"
            title="2. List consultants"
          >
            Fetch consultant catalog. Globetrotter uses these records as bookable people and reads location + planning enrichments.
          </EndpointCard>

          <EndpointCard
            action={
              <div className="action-stack">
                <div className="action-fields">
                  <select
                    disabled={persons.length === 0}
                    value={selectedPersonId}
                    onChange={event => setSelectedPersonId(event.target.value)}
                  >
                    <option value="">Select consultant</option>
                    {persons.map(person => (
                      <option key={person.id} value={person.id}>
                        {person.firstName} {person.lastName}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  className="action-button"
                  disabled={!selectedPersonId || busyKey === 'person-calendars' || !canRunReadCall(host, apiKey)}
                  onClick={runCalendarsCall}
                >
                  {busyKey === 'person-calendars' ? 'Loading...' : 'Run call'}
                </button>
              </div>
            }
            docsUrl={buildScalarOperationUrl(host, SCALAR_FRAGMENTS.personCalendars)}
            endpoint="GET /api/v1/core/persons/{id}/calendars"
            latestCall={findCall(calls, 'person-calendars')}
            method="GET"
            permission="employees:read"
            title="3. List consultant calendars"
          >
            Resolve consultant calendar to book into. Globetrotter usually writes into consultant <code>individual</code> calendar.
          </EndpointCard>

          <EndpointCard
            action={
              <button className="action-button" disabled={!canRunReadCall(host, apiKey) || busyKey === 'skills'} onClick={runSkillsCall}>
                {busyKey === 'skills' ? 'Loading...' : 'Run call'}
              </button>
            }
            docsUrl={buildScalarOperationUrl(host, SCALAR_FRAGMENTS.skills)}
            endpoint="GET /api/v1/core/skills?take=200&skip=0"
            latestCall={findCall(calls, 'skills')}
            method="GET"
            permission="skills:read"
            title="4. List destination skills"
          >
            Load destination catalog for skill references like <code>destinationSkill</code>. In real integration, paginate until{' '}
            <code>pageInfo.hasMore</code> is false.
          </EndpointCard>

          <EndpointCard
            action={
              <button
                className="action-button"
                disabled={!canRunReadCall(host, apiKey) || busyKey === 'custom-property-definitions'}
                onClick={runDefinitionsCall}
              >
                {busyKey === 'custom-property-definitions' ? 'Loading...' : 'Run call'}
              </button>
            }
            docsUrl={buildScalarOperationUrl(host, SCALAR_FRAGMENTS.customPropertyDefinitions)}
            endpoint="GET /api/v1/core/custom-property-definitions?entityType=calendar-slot"
            latestCall={findCall(calls, 'custom-property-definitions')}
            method="GET"
            permission="calendars:read"
            title="5. List booking custom fields"
          >
            Discover which booking fields exist for calendar slots, for example <code>meetingType</code> or <code>destinationSkill</code>.
          </EndpointCard>

          <EndpointCard
            action={
              <div className="action-stack">
                <div className="form-grid compact-grid action-fields">
                  <label className="field-block">
                    <span>Person IDs CSV</span>
                    <input value={availabilityPersonIds} onChange={event => setAvailabilityPersonIds(event.target.value)} />
                  </label>
                  <label className="field-block">
                    <span>From</span>
                    <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} />
                  </label>
                  <label className="field-block">
                    <span>To</span>
                    <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} />
                  </label>
                </div>
                <button
                  className="action-button"
                  disabled={!availabilityPersonIds || busyKey === 'availability' || !canRunReadCall(host, apiKey)}
                  onClick={runAvailabilityCall}
                >
                  {busyKey === 'availability' ? 'Loading...' : 'Run call'}
                </button>
              </div>
            }
            docsUrl={buildScalarOperationUrl(host, SCALAR_FRAGMENTS.availability)}
            endpoint="GET /api/v1/calendar/availability?..."
            latestCall={findCall(calls, 'availability')}
            method="GET"
            permission="calendars:read + plans:read for shift.*"
            title="6. Query booking-ready availability"
          >
            This is core read call for Globetrotter. It returns 15-minute slots, already filtered by blockers and enriched with categories +
            location context.
          </EndpointCard>

          <EndpointCard
            action={
              <div className="action-stack">
                <div className="action-fields action-fields--split">
                  <select
                    disabled={persons.length === 0}
                    value={selectedPersonId}
                    onChange={event => setSelectedPersonId(event.target.value)}
                  >
                    <option value="">Select consultant</option>
                    {persons.map(person => (
                      <option key={person.id} value={person.id}>
                        {person.firstName} {person.lastName}
                      </option>
                    ))}
                  </select>
                  <input type="date" value={workLocationDate} onChange={event => setWorkLocationDate(event.target.value)} />
                </div>
                <button
                  className="action-button"
                  disabled={!selectedPersonId || busyKey === 'work-location' || !canRunReadCall(host, apiKey)}
                  onClick={runWorkLocationCall}
                >
                  {busyKey === 'work-location' ? 'Loading...' : 'Run call'}
                </button>
              </div>
            }
            docsUrl={buildScalarOperationUrl(host, SCALAR_FRAGMENTS.workLocation)}
            endpoint="GET /api/v1/core/persons/{personId}/locations/work-location?date=YYYY-MM-DD"
            latestCall={findCall(calls, 'work-location')}
            method="GET"
            permission="employees:read"
            title="7. Resolve work location"
          >
            Use this after availability to confirm final day-scoped work location. Supported chain is{' '}
            <code>override -&gt; template -&gt; assignment fallback -&gt; none</code>.
          </EndpointCard>

          <EndpointCard
            action={
              <div className="action-stack">
                <div className="form-grid action-fields">
                  <label className="field-block">
                    <span>Calendar ID</span>
                    <input value={selectedCalendarId} onChange={event => setSelectedCalendarId(event.target.value)} />
                  </label>
                  <label className="field-block">
                    <span>Date</span>
                    <input type="date" value={bookingDate} onChange={event => setBookingDate(event.target.value)} />
                  </label>
                  <label className="field-block">
                    <span>Available start time</span>
                    <select
                      disabled={availableBookingTimes.length === 0}
                      value={bookingTime}
                      onChange={event => setBookingTime(event.target.value)}
                    >
                      {availableBookingTimes.length === 0 ? <option value="">No available 15-minute slots</option> : null}
                      {availableBookingTimes.map(time => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-block">
                    <span>Meeting type</span>
                    <select value={bookingCategory} onChange={event => setBookingCategory(event.target.value as BookingCategory)}>
                      {availableCategories.map(category => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-block">
                    <span>Customer name</span>
                    <input value={customerName} onChange={event => setCustomerName(event.target.value)} />
                  </label>
                  <label className="field-block">
                    <span>Email</span>
                    <input value={emailAddress} onChange={event => setEmailAddress(event.target.value)} />
                  </label>
                  <label className="field-block">
                    <span>Phone</span>
                    <input value={phoneNumber} onChange={event => setPhoneNumber(event.target.value)} />
                  </label>
                  <label className="field-block">
                    <span>Destination skill</span>
                    <select value={selectedSkillId} onChange={event => setSelectedSkillId(event.target.value)}>
                      <option value="">Select skill</option>
                      {skills.map(skill => (
                        <option key={skill.id} value={skill.id}>
                          {skill.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <button
                  className="action-button"
                  disabled={
                    !selectedCalendarId ||
                    !bookingTime ||
                    busyKey === 'booking-preflight-availability' ||
                    busyKey === 'booking-write' ||
                    !canRunReadCall(host, apiKey) ||
                    alreadyBookedLocally ||
                    blockedBookingLocally
                  }
                  onClick={runBookingCall}
                >
                  {busyKey === 'booking-preflight-availability'
                    ? 'Checking availability...'
                    : busyKey === 'booking-write'
                    ? 'Sending...'
                    : 'Send booking call'}
                </button>
                {availableBookingTimes.length === 0 ? (
                  <p className="warning-text">
                    No bookable slots for this consultant/date. Availability was loaded but this person has no slots on this day.
                  </p>
                ) : null}
                {bookingError ? <p className="error-text">{bookingError}</p> : null}
                {alreadyBookedLocally ? (
                  <p className="warning-text">This exact calendar/date/time combination was already booked successfully in this browser session.</p>
                ) : null}
                {blockedBookingLocally ? (
                  <p className="warning-text">
                    This exact calendar/date/time combination previously failed with a conflict or unavailable-slot response.
                  </p>
                ) : null}
              </div>
            }
            codeSample={formatJson(bookingPayload)}
            docsUrl={buildScalarOperationUrl(host, SCALAR_FRAGMENTS.bookingWrite)}
            endpoint="PATCH /api/v1/calendar/calendars/{id}"
            latestCall={findCall(calls, 'booking-write')}
            method="PATCH"
            permission="calendars:update"
            title="8. Create booking slot"
            tone="danger"
          >
            This writes real booking data into selected consultant calendar. Client also fills slot-level translations for <code>en</code>,{' '}
            <code>de</code>, <code>fr</code>, and <code>it</code> inside booking payload.
          </EndpointCard>
        </section>

        <aside className="inspector-column">
          <InfoCard title="Loaded data snapshot">
            <ul className="summary-list">
              <li>Consultants loaded: {persons.length}</li>
              <li>Calendars loaded: {personCalendars.length}</li>
              <li>Skills loaded: {skills.length}</li>
              <li>Custom fields loaded: {definitions.length}</li>
              <li>Availability persons: {availability?.data.length ?? 0}</li>
              <li>Work-location entries: {workLocation?.entries.length ?? 0}</li>
              <li>Locally blocked duplicate slots: {successfulBookingKeys.size}</li>
            </ul>
          </InfoCard>

          <InfoCard title="Current booking payload preview">
            <pre>{formatJson(bookingPayload)}</pre>
          </InfoCard>

          <CallHistoryCard calls={calls} onReplay={openReplayDialog} />
        </aside>
      </main>

      <ReplayDialog
        busy={replayBusy}
        draft={replayDraft}
        error={replayError}
        host={host}
        onBodyChange={bodyText => setReplayDraft(current => (current ? { ...current, bodyText } : current))}
        onClose={closeReplayDialog}
        onPathChange={path => setReplayDraft(current => (current ? { ...current, path } : current))}
        onSubmit={submitReplayDialog}
      />
    </div>
  );
}
