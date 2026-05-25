import type {
  IntervalWellness,
  IntervalActivity,
  IntervalActivityDetail,
  IntervalAthlete,
  IntervalEvent,
} from './types'

const BASE_URL = 'https://intervals.icu'

export function createIntervalsClient(apiKey: string, athleteId: string) {
  const encoded = Buffer.from('API_KEY:' + apiKey).toString('base64')
  const headers = {
    'Authorization': 'Basic ' + encoded,
    'Content-Type': 'application/json',
  }

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, { headers, cache: 'no-store' })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new IntervalsApiError(res.status, `GET ${path} failed: ${res.statusText} ${text}`)
    }
    return res.json() as Promise<T>
  }

  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new IntervalsApiError(res.status, `POST ${path} failed: ${res.statusText} ${text}`)
    }
    return res.json() as Promise<T>
  }

  async function put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new IntervalsApiError(res.status, `PUT ${path} failed: ${res.statusText} ${text}`)
    }
    return res.json() as Promise<T>
  }

  return {
    getWellness(oldest: string, newest: string): Promise<IntervalWellness[]> {
      return get<IntervalWellness[]>(
        `/api/v1/athlete/${athleteId}/wellness?oldest=${oldest}&newest=${newest}`
      )
    },

    getActivities(oldest: string, newest: string): Promise<IntervalActivity[]> {
      return get<IntervalActivity[]>(
        `/api/v1/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}`
      )
    },

    getActivityDetail(activityId: string): Promise<IntervalActivityDetail> {
      return get<IntervalActivityDetail>(
        `/api/v1/activity/${activityId}?intervals=true`
      )
    },

    getAthleteSettings(): Promise<IntervalAthlete> {
      return get<IntervalAthlete>(`/api/v1/athlete/${athleteId}`)
    },

    getCalendarEvents(oldest: string, newest: string): Promise<IntervalEvent[]> {
      return get<IntervalEvent[]>(
        `/api/v1/athlete/${athleteId}/events?oldest=${oldest}&newest=${newest}&resolve=true`
      )
    },

    createOrUpdateEvents(events: IntervalEvent[]): Promise<IntervalEvent[]> {
      return post<IntervalEvent[]>(
        `/api/v1/athlete/${athleteId}/events/bulk?upsert=true`,
        events
      )
    },

    deleteEvents(externalIds: string[]): Promise<void> {
      return put<void>(
        `/api/v1/athlete/${athleteId}/events/bulk-delete`,
        externalIds
      )
    },
  }
}

export class IntervalsApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'IntervalsApiError'
  }
}

export type IntervalsClient = ReturnType<typeof createIntervalsClient>
