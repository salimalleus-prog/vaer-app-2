const $ = id => document.getElementById(id);
let position, activeRequest, latestForecast;
const VALID_DAYS = [3, 5, 7, 10];
try { const saved = Number(localStorage.getItem("weather-days")); $("days").value = String(VALID_DAYS.includes(saved) ? saved : 3); } catch {}
try { $('source').value = localStorage.getItem('weather-source') === 'open-meteo' ? 'open-meteo' : 'yr'; } catch {}
const number = value => Number.isFinite(value) ? value.toLocaleString('nb-NO', { maximumFractionDigits: 1 }) : '–';
function weather(code) {
  if (typeof code === 'string') {
    const name = code.replace(/_(day|night|polartwilight)$/, '');
    if (name.includes('thunder')) return ['⛈️', 'Tordenvær'];
    if (name.includes('sleet')) return ['🌨️', 'Sludd'];
    if (name.includes('snow')) return ['❄️', 'Snø'];
    if (name.includes('rain')) return ['🌧️', 'Regn'];
    return ({ clearsky: [code.endsWith('_night') ? '🌙' : '☀️', 'Klart'], fair: ['🌤️', 'Lettskyet'], partlycloudy: ['⛅', 'Delvis skyet'], cloudy: ['☁️', 'Overskyet'], fog: ['🌫️', 'Tåke'] })[name] || ['🌥️', 'Varierende vær'];
  }
  if (code === 0) return ['☀️', 'Klart'];
  if (code === 1 || code === 2) return ['🌤️', 'Lettskyet'];
  if (code === 3) return ['☁️', 'Overskyet'];
  if ([45,48].includes(code)) return ['🌫️', 'Tåke'];
  if ([51,53,55,56,57].includes(code)) return ['🌦️', 'Yr'];
  if ([61,63,65,66,67,80,81,82].includes(code)) return ['🌧️', 'Regn'];
  if ([71,73,75,77,85,86].includes(code)) return ['❄️', 'Snø'];
  if (code >= 95) return ['⛈️', 'Tordenvær'];
  return ['🌥️', 'Varierende vær'];
}
async function json(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw Error('Værtjenesten svarte med HTTP ' + response.status);
  return response.json();
}
async function forecast(source, lat, lon, signal) {
  if (source === 'yr') {
    const data = await json(`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, signal);
    const rows = data.properties.timeseries.filter(row => Date.parse(row.time) >= Date.now() - 3600000);
    if (!rows.length) throw Error('Ingen tilgjengelige varseltimer');
    const hours = rows.slice(0, 6).map(row => ({ time: row.time, temp: row.data.instant.details.air_temperature, code: row.data.next_1_hours?.summary.symbol_code, rain: row.data.next_1_hours?.details.precipitation_amount }));
    const daily = metDaily(rows);
    return { daily, gust: rows[0].data.instant.details.wind_speed_of_gust, temp: hours[0].temp, code: hours[0].code, feels: null, wind: rows[0].data.instant.details.wind_speed, rain: hours[0].rain, hours, updated: data.properties.meta.updated_at, timezone: undefined };
  }
  const params = new URLSearchParams({ latitude: lat, longitude: lon, current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,precipitation', hourly: 'temperature_2m,weather_code,precipitation', daily: 'weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_gusts_10m_max', wind_speed_unit: 'ms', timezone: 'GMT', forecast_days: '11' });
  const data = await json('https://api.open-meteo.com/v1/forecast?' + params, signal);
  const current = data.current;
  const start = data.hourly.time.findIndex(time => Date.parse(time + 'Z') >= Date.now() - 3600000);
  if (start < 0) throw Error('Ingen tilgjengelige varseltimer');
  const daily = data.daily.time.map((date,i) => ({ date, code: data.daily.weather_code[i], min: data.daily.temperature_2m_min[i], max: data.daily.temperature_2m_max[i], wind: data.daily.wind_speed_10m_max[i], gust: data.daily.wind_gusts_10m_max[i] }));
  return { daily, gust: current.wind_gusts_10m, temp: current.temperature_2m, code: current.weather_code, feels: current.apparent_temperature, wind: current.wind_speed_10m, rain: current.precipitation, updated: current.time + 'Z', hours: data.hourly.time.slice(start,start+6).map((time,i) => ({ time: time + 'Z', temp: data.hourly.temperature_2m[start+i], code: data.hourly.weather_code[start+i], rain: data.hourly.precipitation[start+i] })) };
}
// All forecast dates use UTC so both providers share the same day boundaries.
function utcDay(time) { return new Date(time).toISOString().slice(0,10); }
function metDaily(rows) {
  const groups = new Map();
  for (const row of rows) {
    const date = utcDay(row.time), detail = row.data.instant.details;
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push({ ...detail, time: row.time, code: (row.data.next_1_hours || row.data.next_6_hours || row.data.next_12_hours)?.summary.symbol_code });
  }
  return [...groups].map(([date, points]) => {
    const finite = key => points.map(p => p[key]).filter(Number.isFinite);
    const temps = finite('air_temperature'), gusts = finite('wind_speed_of_gust'), winds = finite('wind_speed');
    const middle = points.reduce((a,b) => Math.abs(new Date(a.time).getUTCHours()-12) < Math.abs(new Date(b.time).getUTCHours()-12) ? a : b);
    return { date, code: middle.code, min: temps.length ? Math.min(...temps) : null, max: temps.length ? Math.max(...temps) : null, wind: winds.length ? Math.max(...winds) : null, gust: gusts.length ? Math.max(...gusts) : null };
  });
}
function renderDays() {
  if (!latestForecast) return;
  const count = Number($('days').value), { data, source } = latestForecast;
  const today = utcDay(Date.now());
  const days = data.daily.filter(day => day.date >= today).slice(0,count);
  $('daily').replaceChildren(...days.map(day => {
    const row = document.createElement('tr');
    const values = [new Date(day.date+'T12:00:00Z').toLocaleDateString('nb-NO', {weekday:'short',day:'numeric',month:'short',timeZone:'UTC'}), weather(day.code).join(' '), `${number(day.min)} / ${number(day.max)}°`, number(day.wind), number(day.gust)];
    for (const value of values) { const cell = document.createElement('td'); cell.textContent = value; row.append(cell); }
    return row;
  }));
  $('daily-title').textContent = count + ' dagers varsel';
  $('daily-note').textContent = (days.length < count ? `Kilden har foreløpig ${days.length} av ${count} dager tilgjengelig. ` : '') + 'Døgn følger UTC. ' + (source === 'yr' ? 'Min/maks og sterkeste vind gjelder tilgjengelige varseltidspunkter; i dag bare resten av døgnet. Vindkast vises der MET leverer dem.' : 'Vind og vindkast viser døgnets maksimum.');
}
function moonPhase(date = new Date()) {
  const cycle = 29.530588853;
  const age = ((date.getTime() - Date.UTC(2000,0,6,18,14)) / 86400000 % cycle + cycle) % cycle;
  const fraction = age / cycle;
  const phases = [['🌑','Nymåne'],['🌒','Voksende månesigd'],['🌓','Første kvarter'],['🌔','Voksende måne'],['🌕','Fullmåne'],['🌖','Avtagende måne'],['🌗','Siste kvarter'],['🌘','Avtagende månesigd']];
  return { phase: phases[Math.round(fraction*8)%8], illumination: Math.round((1-Math.cos(2*Math.PI*fraction))/2*100), age };
}
function renderMoon() {
  const moon = moonPhase();
  $('moon-symbol').textContent = moon.phase[0]; $('moon-phase').textContent = moon.phase[1];
  $('moon-detail').textContent = `${moon.illumination} % belyst · beregnet tilnærming for i dag`;
}
function parseTides(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.querySelector('parsererror')) throw Error('Ugyldige tidevannsdata');
  // Kartverket returns astronomical water levels in cm above chart datum.
  return [...doc.querySelectorAll('waterlevel')].map(node => ({time: (node.getAttribute('time') || '').replace(/([+-]\d{2})$/, '$1:00'), value: Number.parseFloat(node.getAttribute('value')), kind: node.getAttribute('flag')})).filter(point => point.time && /(?:Z|[+-]\d{2}:?\d{2})$/.test(point.time) && Number.isFinite(point.value) && Number.isFinite(Date.parse(point.time))).sort((a,b) => Date.parse(a.time)-Date.parse(b.time));
}
async function loadTides(lat, lon, request) {
  $('tide-status').textContent = 'Henter tidevann fra Kartverket …'; $('tides').replaceChildren();
  const from = new Date(), to = new Date(+from+86400000);
  const params = new URLSearchParams({lat:lat.toFixed(4),lon:lon.toFixed(4),fromtime:from.toISOString().slice(0,16),totime:to.toISOString().slice(0,16),datatype:'tab',refcode:'cd',lang:'nb',interval:'60',dst:'0',tzone:'0',tide_request:'locationdata'});
  try {
    const response = await fetch('https://vannstand.kartverket.no/tideapi.php?' + params, {signal:request.signal});
    if (!response.ok) throw Error('Tidevannstjenesten svarer ikke');
    const points = parseTides(await response.text()).filter(p => Date.parse(p.time) >= +from && Date.parse(p.time) <= +to);
    if (activeRequest !== request) return;
    if (!points.length) throw Error('Ingen tidevannsdata for stedet');
    $('tides').replaceChildren(...points.slice(0,8).map(point => {
      const row = document.createElement('li');
      row.textContent = (point.kind === 'high' ? 'Flo · ' : point.kind === 'low' ? 'Fjære · ' : '') + new Date(point.time).toLocaleString('nb-NO',{weekday:'short',hour:'2-digit',minute:'2-digit'}) + ' · ' + number(point.value) + ' cm';
      return row;
    }));
    $('tide-status').textContent = 'Flo og fjære neste 24 timer. Høyde over sjøkartnull. Astronomisk tidevann; værbidrag er ikke inkludert.';
  } catch (error) {
    if (activeRequest !== request || error.name === 'AbortError') return;
    $('tide-status').textContent = 'Tidevann er ikke tilgjengelig her akkurat nå. Kartverket dekker norskekysten; oppslaget kan også feile på grunn av nett eller nettleserbegrensninger.';
  }
}
function render(data, source) {
  latestForecast = { data, source };
  renderDays();
  const w = weather(data.code);
  $('symbol').textContent = w[0]; $('description').textContent = w[1];
  $('temp').textContent = number(Math.round(data.temp)) + '°';
  $('feels').textContent = Number.isFinite(data.feels) ? number(Math.round(data.feels)) + '°' : '–';
  $('feels').title = source === 'yr' ? 'Føles som leveres ikke i dette varselet fra MET.' : '';
  $('gust').textContent = number(data.gust);
  $('gust-note').textContent = Number.isFinite(data.gust) ? '' : 'Kilden leverer ikke vindkast her.';
  $('wind').textContent = number(data.wind); $('rain').textContent = number(data.rain);
  $('hours').replaceChildren(...data.hours.map(hour => {
    const div = document.createElement('div');
    [new Date(hour.time).toLocaleTimeString('nb-NO',{hour:'2-digit',minute:'2-digit'}), weather(hour.code)[0], number(Math.round(hour.temp))+'°', number(hour.rain)+' mm'].forEach((value,i) => {
      const item = document.createElement('div'); item.className = ['', 'emoji', 'degree', 'prob'][i]; item.textContent = value; div.append(item);
    });
    return div;
  }));
  const link = $('credit'); link.textContent = source === 'yr' ? 'Yr / Meteorologisk institutt (CC BY 4.0)' : 'Open-Meteo (CC BY 4.0)';
  link.href = source === 'yr' ? 'https://www.met.no/' : 'https://open-meteo.com/';
  $('status').textContent = 'Oppdatert ' + new Date(data.updated).toLocaleString('nb-NO') + '. Klokkeslett vises i enhetens tidssone.';
}
async function load() {
  if (!position) return;
  activeRequest?.abort(); const request = activeRequest = new AbortController();
  const { lat, lon } = position, source = $('source').value;
  $('status').textContent = 'Henter oppdatert vær …';
  $('weather').setAttribute('aria-busy', 'true');
  // Clear the previous source's values so a failed switch cannot mislabel old data.
  latestForecast = null; $('daily').replaceChildren(); $('daily-note').textContent = '';
  for (const id of ['temp','feels','wind','gust','rain']) $(id).textContent = '–';
  $('hours').replaceChildren(); $('description').textContent = 'Henter værvarsel …'; $('symbol').textContent = '🌤️';
  $('credit').textContent = ''; $('credit').removeAttribute('href');
  renderMoon();
  const tideTask = loadTides(lat, lon, request);
  const placeTask = json(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=no`, request.signal)
    .then(data => { if (activeRequest === request) $('place').textContent = data.locality || data.city || data.principalSubdivision || `${lat.toFixed(3)}°, ${lon.toFixed(3)}°`; })
    .catch(() => {});
  try { const data = await forecast(source, lat, lon, request.signal); if (activeRequest === request) render(data, source); }
  catch (error) { if (activeRequest === request && error.name !== 'AbortError') { $('description').textContent = 'Værvarsel utilgjengelig'; $('status').textContent = 'Kunne ikke hente værdata: ' + error.message + '. Prøv igjen eller velg en annen værkilde.'; } }
  finally { if (activeRequest === request) $('weather').setAttribute('aria-busy','false'); }
  await Promise.allSettled([placeTask, tideTask]);
}
let locating = false;
function locate() {
  if (locating) return;
  if (!navigator.geolocation) { $('status').textContent = 'Posisjon støttes ikke i denne nettleseren'; return; }
  locating = true; $('status').textContent = 'Finner posisjonen din …';
  navigator.geolocation.getCurrentPosition(p => {
    locating = false; position = { lat: p.coords.latitude, lon: p.coords.longitude };
    $('place').textContent = `${position.lat.toFixed(3)}°, ${position.lon.toFixed(3)}°`; load();
  }, () => { locating = false; $('status').textContent = 'Kunne ikke hente posisjon. Kontroller posisjonstillatelsen og bruk HTTPS eller localhost.'; }, { enableHighAccuracy:false, timeout:15000, maximumAge:300000 });
}
$('source').addEventListener('change', () => { try { localStorage.setItem('weather-source', $('source').value); } catch {} if (position) load(); else locate(); });
$('days').addEventListener('change', () => { try { localStorage.setItem('weather-days', $('days').value); } catch {} renderDays(); });
$('locate').addEventListener('click', locate);
$('refresh').addEventListener('click', () => position ? load() : locate());
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
renderMoon();
locate();
