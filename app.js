'use strict';

// Chasing Light: browser Geolocation + two independent data APIs (+ geocoding).
// No keys or backend are required for this non-commercial class project.

const INITIAL_LOCATION = {
  name: 'St. Louis',
  region: 'Missouri',
  country: 'United States',
  latitude: 38.6270,
  longitude: -90.1994,
};
const STORAGE_KEY = 'chasing-light-saved-v1';
const FORECAST_DAYS = 5;

const elements = {
  cityForm: document.querySelector('#city-form'),
  cityInput: document.querySelector('#city-input'),
  searchButton: document.querySelector('#search-button'),
  locateButton: document.querySelector('#locate-button'),
  statusMessage: document.querySelector('#status-message'),
  locationTitle: document.querySelector('#location-title'),
  sceneCard: document.querySelector('#scene-card'),
  sceneCoordinate: document.querySelector('#scene-coordinate'),
  forecastUpdated: document.querySelector('#forecast-updated'),
  loadingState: document.querySelector('#loading-state'),
  forecastContent: document.querySelector('#forecast-content'),
  errorPanel: document.querySelector('#error-panel'),
  errorDescription: document.querySelector('#error-description'),
  retryButton: document.querySelector('#retry-button'),
  featureDate: document.querySelector('#feature-date'),
  featureKicker: document.querySelector('#feature-kicker'),
  featureTitle: document.querySelector('#feature-title'),
  featureSummary: document.querySelector('#feature-summary'),
  featureTime: document.querySelector('#feature-time'),
  featureSave: document.querySelector('#feature-save'),
  featureShare: document.querySelector('#feature-share'),
  featureScore: document.querySelector('#feature-score'),
  scoreRing: document.querySelector('#score-ring'),
  statCloud: document.querySelector('#stat-cloud'),
  statCloudNote: document.querySelector('#stat-cloud-note'),
  statRain: document.querySelector('#stat-rain'),
  statTemp: document.querySelector('#stat-temp'),
  statWind: document.querySelector('#stat-wind'),
  windowsGrid: document.querySelector('#windows-grid'),
  savedList: document.querySelector('#saved-list'),
  filterButtons: document.querySelectorAll('[data-filter]'),
};

const app = {
  location: INITIAL_LOCATION,
  timezone: 'America/Chicago',
  sessions: [],
  featured: null,
  filter: 'all',
  saved: readSaved(),
  requestNumber: 0,
  loading: false,
};

function setStatus(message, isError = false) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.toggle('error', isError);
}

function setLoading(loading) {
  app.loading = loading;
  elements.loadingState.hidden = !loading;
  elements.searchButton.disabled = loading;
  elements.searchButton.textContent = loading ? 'Looking…' : 'Explore ↗';
  elements.locateButton.disabled = loading;
}

function readSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(item =>
      typeof item.id === 'string' &&
      typeof item.location === 'string' &&
      typeof item.time === 'string' &&
      typeof item.score === 'number'
    ).slice(0, 30);
  } catch {
    // Private browsing / disabled storage: the rest of the app still works.
    return [];
  }
}

function persistSaved() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(app.saved));
    return true;
  } catch {
    setStatus('Saving is unavailable in this browser. Favorites will last until you close this page.', true);
    return false;
  }
}

function formatLocal(date, options = {}) {
  return new Intl.DateTimeFormat('en-US', { timeZone: app.timezone, ...options }).format(date);
}

function localDateKey(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const get = name => parts.find(part => part.type === name).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function addUtcDays(yyyyMmDd, days) {
  const date = new Date(`${yyyyMmDd}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function prettyTime(date) {
  return formatLocal(date, { hour: 'numeric', minute: '2-digit', hour12: true });
}

function prettyDate(date) {
  return formatLocal(date, { weekday: 'short', month: 'short', day: 'numeric' });
}

function locationLabel(location) {
  if (location.region) return `${location.name}, ${location.region}`;
  if (location.country && location.name !== 'Your location') {
    return `${location.name}, ${location.country}`;
  }
  return location.name;
}

function coordinateLabel(location) {
  const lat = `${Math.abs(location.latitude).toFixed(2)}° ${location.latitude >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(location.longitude).toFixed(2)}° ${location.longitude >= 0 ? 'E' : 'W'}`;
  return `${lat} / ${lon}`;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`The data service returned ${response.status}.`);
  }
  const json = await response.json();
  if (json.error) throw new Error(json.reason || json.message || 'The data service could not process the request.');
  return json;
}

async function searchCity(city) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', city);
  url.searchParams.set('count', '1');
  url.searchParams.set('language', 'en');
  const result = await fetchJson(url);
  if (!result.results?.length) throw new Error(`We couldn't find “${city}”. Try another city or add the country.`);
  const match = result.results[0];
  return {
    name: match.name,
    region: match.admin1 || '',
    country: match.country || '',
    latitude: match.latitude,
    longitude: match.longitude,
  };
}

function makeWeatherUrl(location) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('hourly', 'cloud_cover,precipitation_probability,temperature_2m,wind_speed_10m,weather_code');
  url.searchParams.set('forecast_days', String(FORECAST_DAYS));
  url.searchParams.set('timezone', 'auto');
  // Unix timestamps + Intl formatting remain correct across daylight-saving transitions.
  url.searchParams.set('timeformat', 'unixtime');
  url.searchParams.set('wind_speed_unit', 'kmh');
  return url;
}

function makeSunUrl(location, timezone) {
  const startDate = localDateKey(new Date(), timezone);
  const url = new URL('https://api.sunrise-sunset.org/v2');
  url.searchParams.set('lat', String(location.latitude));
  url.searchParams.set('lng', String(location.longitude));
  url.searchParams.set('date_start', startDate);
  url.searchParams.set('date_end', addUtcDays(startDate, FORECAST_DAYS - 1));
  return url;
}

function average(values) {
  const valid = values.filter(Number.isFinite);
  if (!valid.length) return null;
  return valid.reduce((total, value) => total + value, 0) / valid.length;
}

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value));
}

// Scores are editorial estimates, not an external prediction or safety signal.
function scoreSession(weather) {
  const cloudPoints = clamp(34 - Math.abs(weather.cloud - 32) * 0.45, 0, 34);
  const dryPoints = 38 * (1 - weather.rain / 100);
  const windPoints = 16 * (1 - clamp(weather.wind / 35, 0, 1));
  const comfortPoints = 12 * (1 - clamp(Math.abs(weather.temp - 18) / 35, 0, 1));
  const stormPenalty = [95, 96, 97, 99].includes(weather.code) ? 20 : 0;
  const rainPenalty = weather.code >= 61 && weather.code <= 82 ? 8 : 0;
  return Math.round(clamp(cloudPoints + dryPoints + windPoints + comfortPoints - stormPenalty - rainPenalty, 0, 100));
}

function sampleWeather(hourly, start, end) {
  const midpoint = (start.getTime() + end.getTime()) / 2;
  const nearest = hourly.time.map((seconds, index) => ({
    index, distance: Math.abs(seconds * 1000 - midpoint),
  })).filter(point => point.distance <= 90 * 60 * 1000)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 2);

  if (!nearest.length) return null;
  const at = variable => average(nearest.map(item => hourly[variable]?.[item.index]));
  const weather = {
    cloud: at('cloud_cover'),
    rain: at('precipitation_probability'),
    temp: at('temperature_2m'),
    wind: at('wind_speed_10m'),
    code: hourly.weather_code?.[nearest[0].index],
  };
  if ([weather.cloud, weather.rain, weather.temp, weather.wind].some(value => value === null)) return null;
  return weather;
}

function classifyClouds(cloud) {
  if (cloud < 15) return 'Mostly clear skies';
  if (cloud < 55) return 'Some texture in the sky';
  if (cloud < 80) return 'Quite a few clouds';
  return 'Mostly overcast';
}

function interpretScore(session) {
  const weather = session.weather;
  if (weather.rain >= 65) return 'Bring a raincoat, or try another window.';
  if (session.score >= 78) return 'A promising mix of light and weather.';
  if (session.score >= 60) return 'Could be lovely. Keep an eye on the clouds.';
  return 'A quieter outlook. The sky may surprise you.';
}

function buildSessions(weather, sun, location) {
  if (!Array.isArray(weather.hourly?.time)) throw new Error('The weather service sent an incomplete forecast.');
  if (!Array.isArray(sun.days)) throw new Error('The sun service sent an incomplete schedule.');

  const now = Date.now();
  const sessions = [];
  for (const day of sun.days) {
    for (const phase of ['morning', 'evening']) {
      const window = day.golden_hour?.[phase];
      if (!window?.begin || !window?.end) continue;
      const start = new Date(window.begin);
      const end = new Date(window.end);
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end.getTime() <= now) continue;
      const observation = sampleWeather(weather.hourly, start, end);
      if (!observation) continue;
      const session = {
        id: `${day.date}-${phase}-${location.latitude.toFixed(3)}-${location.longitude.toFixed(3)}`,
        phase,
        date: day.date,
        start,
        end,
        weather: observation,
        score: scoreSession(observation),
        location: locationLabel(location),
      };
      sessions.push(session);
    }
  }
  return sessions.sort((a, b) => a.start - b.start);
}

function setWeatherDetails(session) {
  const { weather } = session;
  elements.statCloud.textContent = `${Math.round(weather.cloud)}%`;
  elements.statCloudNote.textContent = classifyClouds(weather.cloud);
  elements.statRain.textContent = `${Math.round(weather.rain)}%`;
  elements.statTemp.textContent = `${Math.round(weather.temp)}°C`;
  elements.statWind.textContent = `${Math.round(weather.wind)} km/h`;
}

function isSaved(id) {
  return app.saved.some(item => item.id === id);
}

function savedSnapshot(session) {
  return {
    id: session.id,
    phase: session.phase,
    location: session.location,
    time: `${prettyDate(session.start)} · ${prettyTime(session.start)}–${prettyTime(session.end)}`,
    score: session.score,
  };
}

function toggleSaved(session) {
  if (isSaved(session.id)) {
    app.saved = app.saved.filter(item => item.id !== session.id);
  } else {
    app.saved.unshift(savedSnapshot(session));
    app.saved = app.saved.slice(0, 30);
  }
  persistSaved();
  renderSaved();
  renderWindowCards();
  updateFeatureSave();
}

function updateFeatureSave() {
  if (!app.featured) return;
  const saved = isSaved(app.featured.id);
  elements.featureSave.textContent = saved ? '★ Saved to your moments' : '☆ Save this moment';
  elements.featureSave.setAttribute('aria-pressed', String(saved));
}

function showFeature(session) {
  app.featured = session;
  elements.sceneCard.dataset.phase = session.phase;
  elements.featureDate.textContent = prettyDate(session.start).toUpperCase();
  elements.featureKicker.textContent = `${session.phase.toUpperCase()} GOLDEN HOUR`;
  elements.featureTitle.textContent = session.score >= 76
    ? 'Worth stepping outside for.'
    : session.score >= 57 ? 'Keep your camera close.' : 'Every sky has its own story.';
  elements.featureSummary.textContent = interpretScore(session) +
    ` Expect ${classifyClouds(session.weather.cloud).toLowerCase()} around ${session.phase === 'morning' ? 'sunrise' : 'sunset'}.`;
  elements.featureTime.textContent = `${prettyTime(session.start)} – ${prettyTime(session.end)}`;
  elements.featureScore.textContent = String(session.score);
  elements.scoreRing.style.setProperty('--score-angle', `${session.score}%`);
  elements.scoreRing.setAttribute('aria-label', `Photo potential ${session.score} out of 100`);
  setWeatherDetails(session);
  updateFeatureSave();
}

function createElement(tag, className, textContent) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent !== undefined) element.textContent = textContent;
  return element;
}

function renderWindowCards() {
  elements.windowsGrid.replaceChildren();
  const visible = app.sessions.filter(session => app.filter === 'all' || session.phase === app.filter);
  if (!visible.length) {
    elements.windowsGrid.append(createElement('p', 'empty-saved', 'No upcoming windows in this category. Try another filter.'));
    return;
  }

  for (const session of visible) {
    const card = createElement('article', 'window-card');
    const top = createElement('div', 'window-card-top');
    top.append(createElement('span', 'window-date', prettyDate(session.start).toUpperCase()));
    top.append(createElement('span', 'window-kind', session.phase === 'morning' ? '☼ MORNING' : '☾ EVENING'));

    const main = createElement('div', 'window-card-main');
    const copy = createElement('div');
    copy.append(createElement('h3', '', `${prettyTime(session.start)} – ${prettyTime(session.end)}`));
    copy.append(createElement('p', '', interpretScore(session)));
    const score = createElement('div', 'mini-score');
    score.append(createElement('strong', '', String(session.score)));
    score.append(createElement('span', '', 'POTENTIAL'));
    main.append(copy, score);

    const bottom = createElement('div', 'window-card-bottom');
    bottom.append(createElement('span', 'window-metrics',
      `☁ ${Math.round(session.weather.cloud)}% CLOUD  ·  ☂ ${Math.round(session.weather.rain)}% RAIN`));
    const save = createElement('button', 'save-icon-button', isSaved(session.id) ? '★' : '☆');
    save.type = 'button';
    save.setAttribute('aria-label', `${isSaved(session.id) ? 'Remove' : 'Save'} ${prettyDate(session.start)} ${session.phase} golden hour`);
    save.setAttribute('aria-pressed', String(isSaved(session.id)));
    save.addEventListener('click', () => toggleSaved(session));
    bottom.append(save);
    card.append(top, main, bottom);
    elements.windowsGrid.append(card);
  }
}

function renderSaved() {
  elements.savedList.replaceChildren();
  if (!app.saved.length) {
    const empty = createElement('div', 'empty-saved');
    empty.append(createElement('span', '', '✳'));
    empty.append('No moments saved yet. Found a window you love? Tap the star beside it and keep it here for later.');
    elements.savedList.append(empty);
    return;
  }
  for (const item of app.saved) {
    const row = createElement('div', 'saved-item');
    const copy = createElement('div');
    copy.append(createElement('strong', '', `${item.location} · ${item.phase === 'morning' ? 'Morning' : 'Evening'}`));
    copy.append(createElement('small', '', `${item.time} · ${item.score}/100 at save time`));
    const remove = createElement('button', 'remove-button', 'Remove ×');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove saved ${item.location} window ${item.time}`);
    remove.addEventListener('click', () => {
      app.saved = app.saved.filter(saved => saved.id !== item.id);
      persistSaved();
      renderSaved();
      renderWindowCards();
      updateFeatureSave();
    });
    row.append(copy, remove);
    elements.savedList.append(row);
  }
}

function renderForecast(location) {
  elements.locationTitle.textContent = `Exploring ${locationLabel(location)}`;
  elements.sceneCoordinate.textContent = coordinateLabel(location);
  elements.forecastUpdated.textContent = `5-DAY FORECAST · UPDATED ${formatLocal(new Date(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toUpperCase()}`;
  if (!app.sessions.length) {
    throw new Error('No upcoming golden-hour windows are available for this location. Try another city.');
  }
  // Highlight the strongest window in the coming five days, not simply the next one.
  const best = [...app.sessions].sort((a, b) => b.score - a.score || a.start - b.start)[0];
  showFeature(best);
  renderWindowCards();
  elements.errorPanel.hidden = true;
  elements.forecastContent.hidden = false;
}

async function loadLocation(location) {
  const request = ++app.requestNumber;
  const hadForecast = !elements.forecastContent.hidden;
  setLoading(true);
  elements.errorPanel.hidden = true;
  if (!hadForecast) elements.forecastContent.hidden = true;
  setStatus(`Looking at the skies above ${locationLabel(location)}…`);
  try {
    const weather = await fetchJson(makeWeatherUrl(location));
    if (request !== app.requestNumber) return;
    if (!weather.timezone || !weather.hourly?.time) throw new Error('The forecast is missing its timezone or hourly data.');
    const solar = await fetchJson(makeSunUrl(location, weather.timezone));
    if (request !== app.requestNumber) return;
    const sessions = buildSessions(weather, solar, location);
    if (!sessions.length) throw new Error('There are no forecastable golden-hour windows here in the next five days. Try another location.');
    app.location = location;
    app.timezone = weather.timezone;
    app.sessions = sessions;
    renderForecast(location);
    setStatus(`Showing ${sessions.length} upcoming golden-hour windows.`);
  } catch (error) {
    if (request !== app.requestNumber) return;
    const message = error instanceof TypeError
      ? 'The weather or sun service could not be reached. Check your connection and try again.'
      : error.message || 'Something unexpected happened. Please try again.';
    setStatus(message, true);
    if (!hadForecast) {
      elements.errorDescription.textContent = message;
      elements.errorPanel.hidden = false;
    }
  } finally {
    if (request === app.requestNumber) setLoading(false);
  }
}

async function handleCitySearch(event) {
  event.preventDefault();
  const city = elements.cityInput.value.trim();
  if (city.length < 2) {
    setStatus('Please enter a city name with at least two characters.', true);
    return;
  }
  setStatus(`Finding ${city}…`);
  elements.searchButton.disabled = true;
  try {
    const location = await searchCity(city);
    await loadLocation(location);
  } catch (error) {
    setStatus(error.message || 'City search failed. Please try again.', true);
  } finally {
    if (!app.loading) elements.searchButton.disabled = false;
  }
}

function locateUser() {
  if (!('geolocation' in navigator) || !window.isSecureContext) {
    setStatus('Location access requires HTTPS or localhost. You can search for a city instead.', true);
    return;
  }
  elements.locateButton.disabled = true;
  setStatus('Requesting location permission…');
  navigator.geolocation.getCurrentPosition(
    position => {
      elements.locateButton.disabled = false;
      loadLocation({
        name: 'Your location', region: '', country: '',
        latitude: position.coords.latitude, longitude: position.coords.longitude,
      });
    },
    error => {
      elements.locateButton.disabled = false;
      const message = error.code === 1
        ? 'Location permission was denied. No problem — type a city above instead.'
        : 'We could not determine your location. Try searching for a city instead.';
      setStatus(message, true);
    },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
  );
}

async function shareFeatured() {
  const session = app.featured;
  if (!session) return;
  const text = `Chasing Light: ${session.location} · ${prettyDate(session.start)}, ${prettyTime(session.start)}–${prettyTime(session.end)} (${session.phase} golden hour). Photo potential: ${session.score}/100. Forecast may change.`;
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Chasing Light · Golden hour', text });
      return;
    }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      setStatus('Forecast copied to your clipboard!');
      return;
    }
    setStatus('Your browser does not support sharing here. Try another browser.', true);
  } catch (error) {
    if (error.name !== 'AbortError') setStatus('Sharing was not permitted. You can still save this moment.', true);
  }
}

// Attach event listeners in JavaScript; never use inline onclick attributes.
elements.cityForm.addEventListener('submit', handleCitySearch);
elements.locateButton.addEventListener('click', locateUser);
elements.retryButton.addEventListener('click', () => loadLocation(app.location));
elements.featureSave.addEventListener('click', () => {
  if (app.featured) toggleSaved(app.featured);
});
elements.featureShare.addEventListener('click', shareFeatured);
for (const button of elements.filterButtons) {
  button.addEventListener('click', () => {
    app.filter = button.dataset.filter;
    for (const filterButton of elements.filterButtons) {
      const selected = filterButton === button;
      filterButton.classList.toggle('active', selected);
      filterButton.setAttribute('aria-pressed', String(selected));
    }
    renderWindowCards();
  });
}

renderSaved();
loadLocation(INITIAL_LOCATION);
