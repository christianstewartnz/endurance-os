const GEOCODE_BASE = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_BASE = 'https://api.open-meteo.com/v1/forecast'

export interface Coords {
  lat: number
  lon: number
}

export interface DayForecast {
  tempMaxC: number
  tempMinC: number
  precipitationChance: number
}

export async function geocodeLocation(locationText: string): Promise<Coords | null> {
  try {
    const url = `${GEOCODE_BASE}?name=${encodeURIComponent(locationText)}&count=1&format=json`
    const res = await fetch(url, { next: { revalidate: 86400 } })
    if (!res.ok) return null
    const data = await res.json() as { results?: Array<{ latitude: number; longitude: number }> }
    const first = data.results?.[0]
    if (!first) return null
    return { lat: first.latitude, lon: first.longitude }
  } catch {
    return null
  }
}

export interface WeekForecast {
  [date: string]: DayForecast
}

// Fetches daily forecasts for the next 16 days from today
export async function getForecastRange(lat: number, lon: number): Promise<WeekForecast | null> {
  try {
    const url = `${FORECAST_BASE}?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=16`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const data = await res.json() as {
      daily?: {
        time: string[]
        temperature_2m_max: number[]
        temperature_2m_min: number[]
        precipitation_probability_max: number[]
      }
    }
    const d = data.daily
    if (!d) return null
    const out: WeekForecast = {}
    for (let i = 0; i < d.time.length; i++) {
      out[d.time[i]] = {
        tempMaxC: Math.round(d.temperature_2m_max[i]),
        tempMinC: Math.round(d.temperature_2m_min[i]),
        precipitationChance: Math.round(d.precipitation_probability_max[i] ?? 0),
      }
    }
    return out
  } catch {
    return null
  }
}

// Fetches forecast for a single specific date — returns null if outside the ~16-day window
export async function getForecast(lat: number, lon: number, date: string): Promise<DayForecast | null> {
  const range = await getForecastRange(lat, lon)
  if (!range) return null
  return range[date] ?? null
}
