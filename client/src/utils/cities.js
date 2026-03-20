export function normalizeStateName(value) {
  return String(value || '').trim();
}

export function getUniqueStates(cities = []) {
  return [...new Set(cities.map((city) => normalizeStateName(city.country)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function filterCitiesByState(cities = [], stateName = '') {
  const state = normalizeStateName(stateName);
  if (!state) return cities;
  return cities.filter((city) => normalizeStateName(city.country) === state);
}

export function getCityById(cities = [], cityId) {
  return cities.find((city) => Number(city.id) === Number(cityId)) || null;
}

export function getStateByCityId(cities = [], cityId) {
  return normalizeStateName(getCityById(cities, cityId)?.country);
}
