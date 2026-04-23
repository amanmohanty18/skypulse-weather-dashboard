const $ = id => document.getElementById(id);

// ── Live Clock ──────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  $('liveTime').textContent = now.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  $('liveDate').textContent = now.toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
updateClock();
setInterval(updateClock, 1000);

// ── Fetch: Netlify proxy in prod, direct API on GitHub Pages & local ─
const API_KEY = 'd2863b883c504497b49174620261603';
const IS_NETLIFY = location.hostname.endsWith('.netlify.app');

async function fetchWeather(city) {
  let res;
  if (IS_NETLIFY) {
    res = await fetch(`/.netlify/functions/weather?city=${encodeURIComponent(city)}`);
  } else {
    res = await fetch(`https://api.weatherapi.com/v1/forecast.json?key=${API_KEY}&q=${encodeURIComponent(city)}&days=5&aqi=no&alerts=no`);
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || data.error || 'Something went wrong.');
  return data;
}

// ── Search ──────────────────────────────────────────────────────────
async function searchWeather() {
  const raw = $('cityInput').value.trim();
  if (!raw) return;

  if (!/^[a-zA-Z\s,\-]+$/.test(raw)) {
    showError('Please enter a valid city name.');
    return;
  }

  showError('');
  setLoading(true);

  try {
    const data = await fetchWeather(raw);
    renderWeather(data);
    renderForecast(data);
    renderHourly(data);
  } catch (err) {
    showError(err.message);
    ['weatherCard', 'forecastSection', 'hourlySection'].forEach(id => $(id).classList.add('hidden'));
  } finally {
    setLoading(false);
  }
}

// ── Render ──────────────────────────────────────────────────────────
function renderWeather(data) {
  const c = data.current, l = data.location;
  const today = data.forecast.forecastday[0];

  $('cityName').textContent = `${l.name}, ${l.country}`;
  $('localTime').textContent = l.localtime;
  $('description').textContent = c.condition.text;
  $('temperature').textContent = `${Math.round(c.temp_c)}°C`;
  $('tempRange').textContent = `H: ${Math.round(today.day.maxtemp_c)}°  L: ${Math.round(today.day.mintemp_c)}°`;
  $('feelsLike').textContent = `${Math.round(c.feelslike_c)}°C`;
  $('humidity').textContent = `${c.humidity}%`;
  $('wind').textContent = `${c.wind_kph} kph`;
  $('visibility').textContent = `${c.vis_km} km`;
  $('uvIndex').textContent = getUVLabel(c.uv);
  $('pressure').textContent = `${c.pressure_mb} hPa`;
  $('sunrise').textContent = today.astro.sunrise;
  $('sunset').textContent = today.astro.sunset;
  $('weatherIcon').src = `https:${c.condition.icon.replace('64x64', '128x128')}`;
  $('weatherIcon').alt = c.condition.text;

  $('weatherCard').classList.remove('hidden');
  applyTheme(c.condition.code, c.is_day);
}

function makeForecastCard(d) {
  const card = document.createElement('div');
  card.className = 'forecast-card';

  const day = document.createElement('div');
  day.className = 'day';
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? new Date(d.date + 'T12:00:00') : new Date();
  day.textContent = safeDate.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });

  const img = document.createElement('img');
  const safeIcon = /^\/\/cdn\.weatherapi\.com\//.test(d.day.condition.icon) ? `https:${d.day.condition.icon}` : '';
  img.src = safeIcon;
  img.alt = d.day.condition.text;

  const temp = document.createElement('div');
  temp.className = 'fc-temp';
  temp.textContent = `${Math.round(d.day.avgtemp_c)}°C`;

  const hiLo = document.createElement('div');
  hiLo.className = 'fc-hi-lo';
  hiLo.textContent = `↑${Math.round(d.day.maxtemp_c)}° ↓${Math.round(d.day.mintemp_c)}°`;

  const desc = document.createElement('div');
  desc.className = 'fc-desc';
  desc.textContent = d.day.condition.text;

  card.append(day, img, temp, hiLo, desc);
  return card;
}

function renderForecast(data) {
  const container = $('forecastCards');
  container.innerHTML = '';
  data.forecast.forecastday.forEach(d => container.appendChild(makeForecastCard(d)));
  $('forecastSection').classList.remove('hidden');
}

function makeHourlyCard(h, isNow) {
  const card = document.createElement('div');
  card.className = `hourly-card${isNow ? ' active' : ''}`;

  const time = document.createElement('div');
  time.className = 'h-time';
  time.textContent = isNow ? 'Now' : new Date(h.time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });

  const img = document.createElement('img');
  img.src = `https:${h.condition.icon}`;
  img.alt = h.condition.text;

  const temp = document.createElement('div');
  temp.className = 'h-temp';
  temp.textContent = `${Math.round(h.temp_c)}°`;

  card.append(time, img, temp);
  return card;
}

function renderHourly(data) {
  const now = new Date();
  const hours = data.forecast.forecastday[0].hour.filter(h => new Date(h.time) >= now).slice(0, 12);
  if (!hours.length) { $('hourlySection').classList.add('hidden'); return; }

  const container = $('hourlyCards');
  container.innerHTML = '';
  hours.forEach((h, i) => container.appendChild(makeHourlyCard(h, i === 0)));
  $('hourlySection').classList.remove('hidden');
}

// ── Utilities ───────────────────────────────────────────────────────
function getUVLabel(uv) {
  if (uv <= 2) return `${uv} Low`;
  if (uv <= 5) return `${uv} Moderate`;
  if (uv <= 7) return `${uv} High`;
  if (uv <= 10) return `${uv} Very High`;
  return `${uv} Extreme`;
}

function applyTheme(code, isDay) {
  const orb1 = document.querySelector('.orb1');
  const orb2 = document.querySelector('.orb2');
  if ([1087,1273,1276,1279,1282].includes(code))   { orb1.style.background = '#4a00e0'; orb2.style.background = '#8e2de2'; }
  else if (code >= 1150 && code <= 1201)            { orb1.style.background = '#1e3c72'; orb2.style.background = '#2a5298'; }
  else if (code >= 1210 && code <= 1282)            { orb1.style.background = '#83a4d4'; orb2.style.background = '#b6fbff'; }
  else if (code === 1000 && isDay)                  { orb1.style.background = '#f7971e'; orb2.style.background = '#ffd200'; }
  else if (code === 1000 && !isDay)                 { orb1.style.background = '#0f2027'; orb2.style.background = '#203a43'; }
  else                                              { orb1.style.background = '#6c63ff'; orb2.style.background = '#48cfad'; }
}

function setLoading(on) {
  $('loader').classList.toggle('hidden', !on);
  $('searchBtn').disabled = on;
}

function showError(msg) {
  $('errorMsg').textContent = msg;
  $('error').classList.toggle('hidden', !msg);
}

$('cityInput').addEventListener('keydown', e => { if (e.key === 'Enter') searchWeather(); });
