# Endurance.OS — Intervals.icu API Reference
**Developer reference for all Intervals.icu API interactions**

---

## Overview

Endurance.OS uses Intervals.icu as its data infrastructure layer. All athlete activity data, wellness metrics, fitness estimates, and calendar management flow through the Intervals.icu API. Endurance.OS never communicates directly with Garmin, Wahoo, Zwift, or other devices — Intervals.icu handles all device sync.

**Base URL:** `https://intervals.icu`

**API Docs:** `https://intervals.icu/api-docs.html`

---

## Authentication

### Personal API Key (development / personal use)
Used during development and for users connecting their own account.

```javascript
// Basic auth — API key goes in the password field, any string as username
const headers = {
  'Authorization': 'Basic ' + btoa('API_KEY:' + userApiKey),
  'Content-Type': 'application/json'
}
```

User retrieves their API key from: `https://intervals.icu/settings` → Developer Settings

Store encrypted in Supabase `users.intervals_api_key`. Never expose to frontend.

### OAuth 2.0 (production — third-party app access)
Required for production where Endurance.OS accesses athlete data on their behalf.

**OAuth flow:**
1. Register Endurance.OS as an app at `https://intervals.icu/settings` → Developer Settings
2. Redirect athlete to Intervals.icu OAuth consent page
3. Receive `authorization_code` on redirect
4. Exchange for `access_token` and `refresh_token`
5. Store tokens in Supabase, refresh as needed

**Required OAuth scopes:**

| Scope | Purpose |
|-------|---------|
| `ACTIVITY:READ` | Read completed activities |
| `WELLNESS:READ` | Read HRV, sleep, resting HR |
| `WELLNESS:WRITE` | Push wellness data (if needed) |
| `CALENDAR:READ` | Read planned workouts |
| `CALENDAR:WRITE` | Create/update/delete planned workouts |

```javascript
// OAuth bearer token auth
const headers = {
  'Authorization': 'Bearer ' + accessToken,
  'Content-Type': 'application/json'
}
```

**Athlete ID:** Use `0` in API paths to refer to the athlete the token/key belongs to.
```
/api/v1/athlete/0/activities  ← uses authenticated athlete's ID
```

---

## Endpoints Used by Endurance.OS

### READ OPERATIONS

---

#### Get Completed Activities
Fetches completed workout data for session history and session notes population.

```
GET /api/v1/athlete/{id}/activities
```

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `oldest` | ISO date | Start of date range (e.g. `2025-05-06`) |
| `newest` | ISO date | End of date range (e.g. `2025-06-03`) |

**Example:**
```javascript
const activities = await fetch(
  `https://intervals.icu/api/v1/athlete/0/activities?oldest=${oldest}&newest=${newest}`,
  { headers }
)
```

**Key response fields:**
```json
{
  "id": "i55751783",
  "start_date_local": "2025-06-02T06:30:00",
  "type": "Ride",
  "name": "Threshold intervals 4x8min",
  "moving_time": 5880,
  "elapsed_time": 6120,
  "distance": 48200,
  "total_elevation_gain": 320,
  "average_watts": 241,
  "weighted_average_watts": 283,
  "average_heartrate": 158,
  "max_heartrate": 171,
  "icu_training_load": 128,
  "icu_atl": 68.2,
  "icu_ctl": 71.4,
  "icu_tsb": -12.1,
  "icu_hrss": 118,
  "cardiac_drift_percent": 8.2,
  "decoupling": 4.1
}
```

**When to call:** On webhook trigger (`ACTIVITY_ANALYZED`) or on 15-minute polling fallback. Store key metrics in `session_notes` table.

---

#### Get Wellness Data
Fetches daily HRV, sleep, resting HR, and other readiness metrics.

```
GET /api/v1/athlete/{id}/wellness
```

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `oldest` | ISO date | Start of date range |
| `newest` | ISO date | End of date range |

**Example:**
```javascript
const wellness = await fetch(
  `https://intervals.icu/api/v1/athlete/0/wellness?oldest=${daysAgo(14)}&newest=${today()}`,
  { headers }
)
```

**Key response fields:**
```json
{
  "id": "2025-06-03",
  "ctl": 71.4,
  "atl": 83.5,
  "rampRate": -0.8,
  "ctlLoad": 71.4,
  "atlLoad": 83.5,
  "weight": 62.1,
  "restingHR": 48,
  "hrv": 64,
  "hrvSDNN": 58,
  "sleepSecs": 22320,
  "sleepScore": 71,
  "spO2Average": 97.2,
  "steps": 8420,
  "bodyBattery": 62,
  "form": -12.1
}
```

**Derived field — HRV delta:**
```javascript
// Calculate % deviation from 14-day baseline
const baseline = average(last14Days.map(d => d.hrv))
const delta = ((today.hrv - baseline) / baseline) * 100
// Store as hrv_delta_14d_percent in wellness_cache
```

**When to call:** Daily on sync. Store in `wellness_cache` table. Today's record injected into every system prompt.

---

#### Get Athlete Settings / Fitness Metrics
Fetches FTP, zones, threshold values. Source of truth for fitness metrics.

```
GET /api/v1/athlete/{id}
```

**Key response fields:**
```json
{
  "id": "2049151",
  "ftp": 285,
  "lthr": 168,
  "threshold_pace": 268,
  "threshold_css": 88,
  "weight": 62.1,
  "sport_settings": [
    {
      "type": "Ride",
      "ftp": 285,
      "zones": [
        {"name": "Z1", "min": 0, "max": 152},
        {"name": "Z2", "min": 152, "max": 205},
        {"name": "Z3", "min": 205, "max": 240},
        {"name": "Z4", "min": 240, "max": 285},
        {"name": "Z5", "min": 285, "max": 999}
      ]
    },
    {
      "type": "Run",
      "threshold_pace": 268,
      "zones": [...]
    }
  ]
}
```

**When to call:** Weekly sync + on `SPORT_SETTINGS_UPDATED` webhook. Store in `athlete_profile` fitness metric fields.

**Important:** These are read-only in Endurance.OS. Athletes update FTP/zones inside Intervals.icu. We only cache and display.

---

#### Get Calendar Events (Planned Workouts)
Reads the athlete's planned workout calendar.

```
GET /api/v1/athlete/{id}/events
```

**Query parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `oldest` | ISO date | Start of date range |
| `newest` | ISO date | End of date range |
| `resolve` | boolean | If true, returns actual watts/bpm/pace values (not zone references) |

**Example:**
```javascript
const events = await fetch(
  `https://intervals.icu/api/v1/athlete/0/events?oldest=${weekStart}&newest=${weekEnd}&resolve=true`,
  { headers }
)
```

**Key response fields:**
```json
{
  "id": 48566307,
  "start_date_local": "2025-06-03T00:00:00",
  "type": "Ride",
  "name": "Threshold intervals 4×8min",
  "description": "- 15m 55%\n4x\n- 8m 95%\n- 4m 55%\n- 10m 55%",
  "category": "WORKOUT",
  "icu_training_load": 128,
  "external_id": "endurance-os-abc123",
  "oauth_client_id": "your-client-id"
}
```

**When to call:** On dashboard load and on `CALENDAR_UPDATED` webhook. Used to display planned sessions in Endurance.OS calendar view.

---

### WRITE OPERATIONS

---

#### Create / Update Planned Workouts (Upsert)
The primary write endpoint. Creates new planned workouts or updates existing ones on the athlete's calendar. Intervals.icu then syncs these to connected devices (Garmin, Wahoo, Zwift, Coros).

```
POST /api/v1/athlete/{id}/events/bulk?upsert=true
```

**This is how AI-proposed plan adaptations are applied after user acceptance.**

**Request body — single session swap:**
```javascript
await fetch(
  'https://intervals.icu/api/v1/athlete/0/events/bulk?upsert=true',
  {
    method: 'POST',
    headers,
    body: JSON.stringify([
      {
        category: 'WORKOUT',
        start_date_local: '2025-06-03T00:00:00',
        type: 'Ride',
        name: '90 min Z2 (adapted from threshold)',
        description: '- 15m 55%\n- 60m 60%\n- 15m 55%',
        icu_training_load: 62,
        external_id: 'endurance-os-session-20250603' // your ID for tracking
      }
    ])
  }
)
```

**Workout description format (Intervals.icu native):**
```
- {duration} {intensity}    → steady state block
- {reps}x                   → repeat block starts
- {duration} {intensity}    → interval within repeat

Examples:
  "- 15m 55%"               → 15 min at 55% FTP
  "- 8m 95%"                → 8 min at 95% FTP  
  "4x\n- 5m 105%\n- 3m 55%" → 4 reps of 5min on / 3min off

Intensity can be:
  55%     → percentage of FTP (cycling) or threshold pace (running)
  285W    → absolute watts
  Z2      → zone reference (resolved if resolve=true in GET)
  4:30/km → absolute pace (running)
```

**Request body — full week plan:**
```javascript
const weekWorkouts = [
  {
    category: 'WORKOUT',
    start_date_local: '2025-06-02T00:00:00',
    type: 'Ride',
    name: 'Z2 base',
    description: '- 90m 60%',
    icu_training_load: 62,
    external_id: 'endurance-os-20250602'
  },
  {
    category: 'WORKOUT',
    start_date_local: '2025-06-03T00:00:00',
    type: 'Ride',
    name: 'Threshold 4×8min',
    description: '- 15m 55%\n4x\n- 8m 95%\n- 4m 55%\n- 10m 55%',
    icu_training_load: 128,
    external_id: 'endurance-os-20250603'
  },
  // ... rest of week
]

await fetch(
  'https://intervals.icu/api/v1/athlete/0/events/bulk?upsert=true',
  { method: 'POST', headers, body: JSON.stringify(weekWorkouts) }
)
```

**Using external_id:**
- Always set `external_id` to a unique ID from your system (e.g. `endurance-os-{date}-{userId}`)
- On upsert, events with matching `external_id` are updated, not duplicated
- Lets you push updated sessions without storing Intervals' internal event IDs
- `external_id` only matches events created by your application

**Response:** Full representation of each created/updated event including Intervals' internal `id`.

---

#### Delete Planned Workouts
Removes planned sessions from the calendar (e.g. when injury removes running sessions).

```
PUT /api/v1/athlete/{id}/events/bulk-delete
```

```javascript
await fetch(
  'https://intervals.icu/api/v1/athlete/0/events/bulk-delete',
  {
    method: 'PUT',
    headers,
    body: JSON.stringify([
      { external_id: 'endurance-os-20250610-run' },
      { external_id: 'endurance-os-20250617-run' }
    ])
  }
)
```

Events that don't exist are ignored. Returns count of deleted events.

---

## Webhooks

Webhooks are the real-time trigger for syncing data into Endurance.OS. Configure in Intervals.icu settings under your app management page.

### Webhook events used by Endurance.OS

| Event | Trigger | Endurance.OS Action |
|-------|---------|---------------------|
| `ACTIVITY_UPLOADED` | New activity synced from Garmin | Begin activity processing |
| `ACTIVITY_ANALYZED` | Intervals.icu has finished analysing activity | Fetch full metrics, update `session_notes` |
| `CALENDAR_UPDATED` | Planned workout added/changed/deleted | Refresh calendar state in Endurance.OS |
| `SPORT_SETTINGS_UPDATED` | FTP, zones, or thresholds changed | Refresh `athlete_profile` fitness fields |

**Note:** Activity webhooks are NOT delivered for Strava activities.

### Webhook payload structure

```json
{
  "secret": "your-webhook-secret",
  "events": [
    {
      "athlete_id": "2049151",
      "type": "ACTIVITY_ANALYZED",
      "timestamp": "2025-06-03T07:45:00.000+00:00",
      "activity": {
        "id": "i55751783",
        "type": "Ride",
        "start_date_local": "2025-06-03T06:30:00",
        "icu_training_load": 128
      }
    }
  ]
}
```

### Webhook handler (pseudocode)

```javascript
app.post('/webhooks/intervals', async (req, res) => {
  const { secret, events } = req.body

  // Verify secret
  if (secret !== process.env.INTERVALS_WEBHOOK_SECRET) {
    return res.status(401).send()
  }

  // Must return 2xx or Intervals will retry with exponential backoff
  res.status(200).send()

  // Process async after responding
  for (const event of events) {
    const userId = await getUserByIntervalsAthleteId(event.athlete_id)
    if (!userId) continue

    switch (event.type) {
      case 'ACTIVITY_ANALYZED':
        await syncActivity(userId, event.activity.id)
        break
      case 'CALENDAR_UPDATED':
        await refreshCalendar(userId)
        break
      case 'SPORT_SETTINGS_UPDATED':
        await syncFitnessMetrics(userId)
        break
    }
  }
})
```

**Important:** Respond with `2xx` immediately before processing. Intervals retries webhooks with exponential backoff if it doesn't receive a 2xx. Processing after responding prevents timeouts on complex sync operations.

**Webhook deduplication:** The same `CALENDAR_UPDATED` event can fire multiple times for the same calendar event if it's changed rapidly. Use `external_id` and `oauth_client_id` fields to filter for your app's events and implement idempotent processing.

---

## Sync Strategy

### Polling fallback (when webhooks aren't firing)

```javascript
// Run every 15 minutes as cron job
async function pollForUpdates(userId) {
  const lastSync = await getLastSyncTime(userId)
  const now = new Date()

  // Fetch activities since last sync
  await syncActivitiesSince(userId, lastSync)

  // Fetch wellness for last 2 days (in case of late uploads)
  await syncWellness(userId, daysAgo(2), today())

  await updateLastSyncTime(userId, now)
}
```

### Full sync schedule

| Data | Trigger | Fallback polling |
|------|---------|-----------------|
| Completed activities | `ACTIVITY_ANALYZED` webhook | Every 15 min |
| Wellness (HRV/sleep) | Daily cron at 07:00 local time | Every 15 min |
| Fitness metrics (FTP/zones) | `SPORT_SETTINGS_UPDATED` webhook | Weekly |
| Calendar events | `CALENDAR_UPDATED` webhook | On dashboard load |

---

## Workout Format Reference

When the AI generates a new workout or modifies an existing one, it must output in Intervals.icu description format. The AI should be instructed to always use this format for any session it creates.

### Common workout patterns

**Z2 endurance:**
```
- 15m 55%
- 60m 62%
- 15m 55%
```

**Threshold intervals:**
```
- 15m 55%
4x
- 8m 95%
- 4m 55%
- 10m 55%
```

**VO2max intervals:**
```
- 15m 55%
6x
- 3m 110%
- 3m 50%
- 10m 55%
```

**Tempo:**
```
- 10m 55%
- 40m 80%
- 10m 55%
```

**Running (pace-based):**
```
- 15m easy
4x
- 5m threshold
- 2m easy
- 10m easy
```

### Workout payload fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `category` | string | Yes | Always `"WORKOUT"` for sessions |
| `start_date_local` | ISO datetime | Yes | Date of planned session |
| `type` | string | Yes | `Ride`, `Run`, `Swim`, `WeightTraining` etc. |
| `name` | string | Yes | Human-readable session name |
| `description` | string | Yes | Intervals.icu workout format |
| `icu_training_load` | int | Recommended | Estimated TSS |
| `external_id` | string | Recommended | Your system's ID for upsert tracking |
| `moving_time` | int | Optional | Expected duration in seconds |

---

## Error Handling

```javascript
async function intervalsApiCall(url, options, userId) {
  try {
    const response = await fetch(url, options)

    if (response.status === 401) {
      // Token expired — refresh OAuth token and retry
      await refreshOAuthToken(userId)
      return await fetch(url, { ...options, headers: await getHeaders(userId) })
    }

    if (response.status === 429) {
      // Rate limited — back off and retry
      const retryAfter = response.headers.get('Retry-After') || 60
      await sleep(retryAfter * 1000)
      return await fetch(url, options)
    }

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Intervals API error ${response.status}: ${error.message}`)
    }

    return await response.json()

  } catch (err) {
    console.error('Intervals API call failed:', err)
    // Log to monitoring, do not surface raw error to user
    throw err
  }
}
```

---

## Key Implementation Notes

**Athlete ID zero shortcut:** Always use `0` as the athlete ID in API paths when using a personal API key or OAuth token. Intervals.icu resolves `0` to the authenticated athlete.

**Partial updates:** When updating an activity, only send the fields you want to change. To clear a numeric field, send `-1`.

**Date format:** All dates use ISO-8601 local time (`2025-06-03T06:30:00`) not UTC. Intervals.icu stores and returns local time — no timezone conversion needed for display.

**Wellness locked flag:** If a wellness record is locked (`"locked": true`), third-party API writes to that date will be overridden by Intervals' device sync. Use locking carefully.

**Calendar filtering:** When reading calendar events, filter by `oauth_client_id` to find only events created by Endurance.OS. Other events (from Garmin sync, manual entry, other apps) will also appear.

**Garmin sync via Intervals:** Endurance.OS never calls Garmin's API directly. Planned workouts written to Intervals.icu calendar are automatically pushed to connected Garmin devices by Intervals.icu. The athlete must have Garmin Connect linked in their Intervals.icu settings.

**Rate limits:** Intervals.icu does not publish explicit rate limits but the API is designed for regular polling. Avoid hammering — use webhooks as primary trigger, polling as fallback. Batch writes using the `/bulk` endpoints wherever possible.

---

## Useful Links

- API Docs: https://intervals.icu/api-docs.html
- API Access Guide: https://forum.intervals.icu/t/api-access-to-intervals-icu/609
- OAuth Guide: https://forum.intervals.icu/t/intervals-icu-oauth-support/2759
- Upload Planned Workouts: https://forum.intervals.icu/t/uploading-planned-workouts-to-intervals-icu/63624
- Integration Cookbook: https://forum.intervals.icu/t/intervals-icu-api-integration-cookbook/80090
- API Terms: https://forum.intervals.icu/t/intervals-icu-api-terms-and-conditions/114087

---

*This document covers all Intervals.icu API interactions for Endurance.OS v1.*
*Last updated: v1.0*
