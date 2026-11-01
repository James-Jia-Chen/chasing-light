# Chasing Light — Website #2

A responsive, single-page photography planner that combines precise solar timing and real weather forecasts to recommend upcoming golden-hour sessions.

## Run

1. Open the project folder in VS Code.
2. Start a local web server (recommended: VS Code **Live Server**), or run `python3 -m http.server 8000` from this folder.
3. Visit `http://localhost:8000`.
4. Search for a city, or use **Use my current location** (browser permission required). Try filtering morning/evening windows, saving a favorite, and sharing the top recommendation.

The default page displays **St. Louis as a demo city**. It does not claim to have detected your location.

## Assignment rubric: APIs

| API | Category | Where / why |
|---|---|---|
| Geolocation API | Browser API | `navigator.geolocation.getCurrentPosition`; location button; permission-denial fallback |
| Open-Meteo Forecast API | Data API | Forecast clouds, precipitation probability, temperature, wind, and weather codes |
| Sunrise-Sunset.org API v2 | Data API | Exact *morning and evening golden-hour start/end* for five days |
| Open-Meteo Geocoding API | Data API | Resolve manual city searches to latitude / longitude |
| Web Storage (`localStorage`) | Browser API | Save/remove photography windows locally |
| Web Share / Clipboard API | Browser API | Share or copy an upcoming session, with graceful fallback |

### Core integration

1. Geolocate or geocode coordinates.
2. Request a five-day weather forecast with Unix timestamps and the location's IANA time zone.
3. Request golden-hour time windows for the same location and local dates.
4. Sample forecast data around each exact golden-hour window.
5. Compute a documented *photo potential* heuristic and rank the sessions.

The score uses partial cloud cover (up to 34 points), lower precipitation probability (38), lower wind (16), and comfortable temperature (12), with penalties for severe weather. It is a creative planning metric, **not** a safety prediction or objective measure of photographic quality.

## Error handling / usability

- City not found → explanatory message; existing results stay visible.
- Weather or solar API fails → friendly error state with retry; previously loaded results stay visible.
- Geolocation unsupported, non-secure, timed out, or denied → user can search manually.
- Storage disabled → app keeps functioning and provides explanatory feedback.
- Polar regions with no golden hour → explanatory message rather than broken data.
- Keyboard-accessible controls, semantic HTML, meaningful ARIA labels, mobile layout, reduced-motion support, and no inline event handlers.

## Testing checklist

- [ ] Load default St. Louis forecast.
- [ ] Search `Paris, France` and `Tokyo, Japan`.
- [ ] Search a nonsense city and check friendly fallback.
- [ ] Deny geolocation in browser settings and try again.
- [ ] Toggle All / Mornings / Evenings.
- [ ] Save and unsave a card; refresh and confirm persistence.
- [ ] Share a forecast (uses Web Share or Clipboard depending on browser).
- [ ] Disable internet / block an API in DevTools and retry.
- [ ] Open developer console: no unhandled errors.
- [ ] Check narrow/mobile screen widths.

## Data attribution

Weather and geocoding: [Open-Meteo](https://open-meteo.com/). Solar events: [Sunrise-Sunset.org](https://sunrise-sunset.org/) (visible credit in app footer). No registration or API key needed for class/demo usage.

## Files

- `index.html` — semantic single-page structure
- `styles.css` — responsive visual design
- `app.js` — APIs, scoring logic, state, events, rendering
