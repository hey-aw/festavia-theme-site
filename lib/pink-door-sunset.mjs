const radians = Math.PI / 180;
const dayMilliseconds = 86_400_000;
const julianUnixEpoch = 2_440_588;
const julianJ2000 = 2_451_545;
const solarTransitOffset = 0.0009;
const earthObliquity = 23.4397 * radians;
const standardSunsetAltitude = -0.833 * radians;

// Portland city-center coordinates keep the public schedule location-specific
// without storing a private residential address.
export const PINK_DOOR_LATITUDE = 45.5152;
export const PINK_DOOR_LONGITUDE = -122.6784;

function toJulian(date) {
  return date.valueOf() / dayMilliseconds - 0.5 + julianUnixEpoch;
}

function fromJulian(value) {
  return new Date((value + 0.5 - julianUnixEpoch) * dayMilliseconds);
}

function normalizeCycle(days, longitudeWest) {
  return Math.round(
    days - solarTransitOffset - longitudeWest / (2 * Math.PI),
  );
}

function approximateTransit(hourAngle, longitudeWest, cycle) {
  return (
    solarTransitOffset +
    (hourAngle + longitudeWest) / (2 * Math.PI) +
    cycle
  );
}

function solarMeanAnomaly(days) {
  return radians * (357.5291 + 0.98560028 * days);
}

function eclipticLongitude(meanAnomaly) {
  const equationOfCenter =
    radians *
    (1.9148 * Math.sin(meanAnomaly) +
      0.02 * Math.sin(2 * meanAnomaly) +
      0.0003 * Math.sin(3 * meanAnomaly));
  return (
    meanAnomaly + equationOfCenter + 102.9372 * radians + Math.PI
  );
}

function declination(longitude) {
  return Math.asin(Math.sin(longitude) * Math.sin(earthObliquity));
}

function sunsetHourAngle(latitude, sunDeclination) {
  return Math.acos(
    (Math.sin(standardSunsetAltitude) -
      Math.sin(latitude) * Math.sin(sunDeclination)) /
      (Math.cos(latitude) * Math.cos(sunDeclination)),
  );
}

function solarTransitJulian(approximate, meanAnomaly, longitude) {
  return (
    julianJ2000 +
    approximate +
    0.0053 * Math.sin(meanAnomaly) -
    0.0069 * Math.sin(2 * longitude)
  );
}

/**
 * Returns standard sunset (solar altitude -0.833 degrees) for the solar day
 * containing the supplied local-noon reference instant.
 */
export function pinkDoorSunset(referenceInstant) {
  const reference =
    referenceInstant instanceof Date
      ? referenceInstant
      : new Date(referenceInstant);
  if (Number.isNaN(reference.getTime())) {
    throw new Error("Invalid sunset reference instant.");
  }

  const longitudeWest = -PINK_DOOR_LONGITUDE * radians;
  const latitude = PINK_DOOR_LATITUDE * radians;
  const days = toJulian(reference) - julianJ2000;
  const cycle = normalizeCycle(days, longitudeWest);
  const transit = approximateTransit(0, longitudeWest, cycle);
  const meanAnomaly = solarMeanAnomaly(transit);
  const longitude = eclipticLongitude(meanAnomaly);
  const sunDeclination = declination(longitude);
  const hourAngle = sunsetHourAngle(latitude, sunDeclination);
  const sunsetTransit = approximateTransit(
    hourAngle,
    longitudeWest,
    cycle,
  );
  return fromJulian(
    solarTransitJulian(sunsetTransit, meanAnomaly, longitude),
  );
}
