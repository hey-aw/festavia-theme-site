import { execFileSync } from "node:child_process";

export const FESTAVIA_LIGHT_NAME = "Festavia permanent 1";
export const FESTAVIA_BRIGHTNESS = 75;
export const FESTAVIA_TRANSITION_MS = 3000;
export const FESTAVIA_COLOR_EFFECTS = Object.freeze(["sunbeam"]);

const STATIC_MODES = new Set(["Static gradient", "Static catalog fallback"]);
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const CANDIDATE_FIELDS = new Set([
  "id",
  "preferenceRank",
  "observanceName",
  "observanceSynopsis",
  "sourceUrl",
  "palette",
  "mode",
  "effect",
  "lightingSynopsis",
  "fallbackPalette",
  "voteCount",
]);

function asRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} is invalid.`);
  }
  return value;
}

function unquoteYamlScalar(value) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseOpenHueConfig(contents) {
  const values = new Map();
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/);
    if (!match) continue;
    if (values.has(match[1])) {
      throw new Error("OpenHue bridge configuration contains duplicate fields.");
    }
    values.set(match[1], unquoteYamlScalar(match[2]));
  }

  const bridge = values.get("bridge");
  const key = values.get("key");
  if (!bridge || !key || /[\r\n]/.test(bridge) || /[\r\n]/.test(key)) {
    throw new Error("OpenHue bridge configuration is incomplete.");
  }

  let bridgeUrl;
  try {
    bridgeUrl = new URL(bridge.includes("://") ? bridge : `https://${bridge}`);
  } catch {
    throw new Error("OpenHue bridge address is invalid.");
  }
  if (
    bridgeUrl.protocol !== "https:" ||
    bridgeUrl.username ||
    bridgeUrl.password ||
    (bridgeUrl.pathname !== "/" && bridgeUrl.pathname !== "") ||
    bridgeUrl.search ||
    bridgeUrl.hash
  ) {
    throw new Error("OpenHue bridge address is invalid.");
  }

  return { bridgeUrl: bridgeUrl.origin, key };
}

function escapeCurlConfigValue(value) {
  return String(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("\"", "\\\"")
    .replaceAll("\r", "\\r")
    .replaceAll("\n", "\\n");
}

function curlConfigLine(name, value) {
  return `${name} = "${escapeCurlConfigValue(value)}"`;
}

export function createCurlRequester({
  bridgeUrl,
  key,
  execFile = execFileSync,
}) {
  return async function request(method, path, body = null) {
    if (!path.startsWith("/clip/v2/resource/")) {
      throw new Error("Hue API path is invalid.");
    }

    const config = [
      "silent",
      "show-error",
      "fail-with-body",
      "insecure",
      "connect-timeout = 5",
      "max-time = 12",
      curlConfigLine("url", `${bridgeUrl}${path}`),
      curlConfigLine("request", method),
      curlConfigLine("header", `hue-application-key: ${key}`),
    ];
    if (body !== null) {
      config.push(curlConfigLine("header", "Content-Type: application/json"));
      config.push(curlConfigLine("data", JSON.stringify(body)));
    }

    let output;
    try {
      output = execFile("/usr/bin/curl", ["--config", "-"], {
        encoding: "utf8",
        input: `${config.join("\n")}\n`,
        maxBuffer: 4 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      throw new Error("Hue bridge request failed.");
    }

    let parsed;
    try {
      parsed = JSON.parse(output);
    } catch {
      throw new Error("Hue bridge returned an invalid response.");
    }
    if (!Array.isArray(parsed.errors) || parsed.errors.length > 0) {
      throw new Error("Hue bridge rejected the request.");
    }
    if (!Array.isArray(parsed.data)) {
      throw new Error("Hue bridge response is incomplete.");
    }
    return parsed;
  };
}

function normalizedChannel(value) {
  const channel = value / 255;
  return channel > 0.04045
    ? ((channel + 0.055) / 1.055) ** 2.4
    : channel / 12.92;
}

function pointInTriangle(point, red, green, blue) {
  const denominator =
    (green.y - blue.y) * (red.x - blue.x) +
    (blue.x - green.x) * (red.y - blue.y);
  if (Math.abs(denominator) < Number.EPSILON) return false;
  const a =
    ((green.y - blue.y) * (point.x - blue.x) +
      (blue.x - green.x) * (point.y - blue.y)) /
    denominator;
  const b =
    ((blue.y - red.y) * (point.x - blue.x) +
      (red.x - blue.x) * (point.y - blue.y)) /
    denominator;
  const c = 1 - a - b;
  return a >= 0 && b >= 0 && c >= 0;
}

function closestPointOnSegment(point, first, second) {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return first;
  const projection =
    ((point.x - first.x) * dx + (point.y - first.y) * dy) /
    lengthSquared;
  const amount = Math.max(0, Math.min(1, projection));
  return {
    x: first.x + amount * dx,
    y: first.y + amount * dy,
  };
}

function squaredDistance(first, second) {
  return (first.x - second.x) ** 2 + (first.y - second.y) ** 2;
}

export function clipXyToGamut(point, gamut) {
  if (!gamut?.red || !gamut?.green || !gamut?.blue) {
    throw new Error("Festavia color gamut is unavailable.");
  }
  if (pointInTriangle(point, gamut.red, gamut.green, gamut.blue)) return point;

  const candidates = [
    closestPointOnSegment(point, gamut.red, gamut.green),
    closestPointOnSegment(point, gamut.green, gamut.blue),
    closestPointOnSegment(point, gamut.blue, gamut.red),
  ];
  return candidates.reduce((closest, candidate) =>
    squaredDistance(point, candidate) < squaredDistance(point, closest)
      ? candidate
      : closest,
  );
}

export function hexToGamutXy(hex, gamut) {
  if (typeof hex !== "string" || !HEX_COLOR.test(hex)) {
    throw new Error("Palette color must use #RRGGBB.");
  }
  const red = normalizedChannel(Number.parseInt(hex.slice(1, 3), 16));
  const green = normalizedChannel(Number.parseInt(hex.slice(3, 5), 16));
  const blue = normalizedChannel(Number.parseInt(hex.slice(5, 7), 16));

  const xComponent = red * 0.664511 + green * 0.154324 + blue * 0.162028;
  const yComponent = red * 0.283881 + green * 0.668433 + blue * 0.047685;
  const zComponent = red * 0.000088 + green * 0.07231 + blue * 0.986039;
  const total = xComponent + yComponent + zComponent;
  const xy =
    total === 0
      ? { x: 0.3227, y: 0.329 }
      : { x: xComponent / total, y: yComponent / total };
  const clipped = clipXyToGamut(xy, gamut);
  return {
    x: Number(clipped.x.toFixed(4)),
    y: Number(clipped.y.toFixed(4)),
  };
}

function validatePalette(palette, label) {
  if (!Array.isArray(palette) || palette.length < 3 || palette.length > 5) {
    throw new Error(`${label} must contain 3-5 colors.`);
  }
  return palette.map((entry, index) => {
    const color = asRecord(entry, `${label}[${index}]`);
    if (
      typeof color.name !== "string" ||
      !color.name.trim() ||
      typeof color.hex !== "string" ||
      !HEX_COLOR.test(color.hex)
    ) {
      throw new Error(`${label}[${index}] is invalid.`);
    }
    return { name: color.name.trim(), hex: color.hex.toUpperCase() };
  });
}

function validateEffectPalette(palette) {
  if (!Array.isArray(palette) || palette.length > 1) {
    throw new Error("Effect palette must contain at most one tint color.");
  }
  if (palette.length === 0) return [];
  const color = asRecord(palette[0], "palette[0]");
  if (
    typeof color.name !== "string" ||
    !color.name.trim() ||
    typeof color.hex !== "string" ||
    !HEX_COLOR.test(color.hex)
  ) {
    throw new Error("palette[0] is invalid.");
  }
  return [{ name: color.name.trim(), hex: color.hex.toUpperCase() }];
}

export function buildStaticGradientPayload(palette, gamut) {
  const colors = validatePalette(palette, "palette");
  return {
    on: { on: true },
    dimming: { brightness: FESTAVIA_BRIGHTNESS },
    gradient: {
      mode: "interpolated_palette",
      points: colors.map((color) => ({
        color: { xy: hexToGamutXy(color.hex, gamut) },
      })),
    },
    effects_v2: { action: { effect: "no_effect" } },
    timed_effects: { effect: "no_effect" },
    dynamics: { duration: FESTAVIA_TRANSITION_MS },
  };
}

export function buildEffectPayload(effect, tint = null, gamut = null) {
  if (typeof effect !== "string" || effect === "no_effect") {
    throw new Error("Hue effect is invalid.");
  }
  const action = { effect };
  if (tint !== null) {
    const [normalizedTint] = validateEffectPalette([tint]);
    action.parameters = {
      color: { xy: hexToGamutXy(normalizedTint.hex, gamut) },
    };
  }
  return {
    on: { on: true },
    dimming: { brightness: FESTAVIA_BRIGHTNESS },
    effects_v2: { action },
  };
}

function effectStatus(light) {
  const modern = light.effects_v2?.status;
  if (typeof modern === "string") return modern;
  if (modern && typeof modern.effect === "string") return modern.effect;
  const legacy = light.effects?.status;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy.effect === "string") return legacy.effect;
  return null;
}

function timedEffectStatus(light) {
  const status = light.timed_effects?.status;
  if (typeof status === "string") return status;
  if (status && typeof status.effect === "string") return status.effect;
  return typeof light.timed_effects?.effect === "string"
    ? light.timed_effects.effect
    : null;
}

function effectValues(light) {
  const modern = light.effects_v2?.action?.effect_values;
  if (Array.isArray(modern)) return modern;
  return Array.isArray(light.effects?.effect_values)
    ? light.effects.effect_values
    : [];
}

function effectColorValues(light) {
  const available = new Set(effectValues(light));
  return FESTAVIA_COLOR_EFFECTS.filter((effect) => available.has(effect));
}

function effectStatusParameters(light) {
  const status = light.effects_v2?.status;
  return status && typeof status === "object" ? status.parameters ?? null : null;
}

function publicEffectStatusParameters(light) {
  const parameters = effectStatusParameters(light);
  if (!parameters || typeof parameters !== "object") return null;
  const result = {};
  const xy = parameters.color?.xy;
  if (typeof xy?.x === "number" && typeof xy?.y === "number") {
    result.color = { xy: { x: xy.x, y: xy.y } };
  }
  const colorTemperature = parameters.color_temperature;
  if (colorTemperature && typeof colorTemperature === "object") {
    result.colorTemperature = {
      mirek:
        typeof colorTemperature.mirek === "number"
          ? colorTemperature.mirek
          : null,
      mirekValid: colorTemperature.mirek_valid === true,
    };
  }
  if (typeof parameters.speed === "number") {
    result.speed = parameters.speed;
  }
  return Object.keys(result).length > 0 ? result : null;
}

function xyMatches(actual, expected) {
  return (
    typeof actual?.x === "number" &&
    typeof actual?.y === "number" &&
    Math.abs(actual.x - expected.x) <= 0.002 &&
    Math.abs(actual.y - expected.y) <= 0.002
  );
}

function commonStateMatches(light) {
  return (
    light.on?.on === true &&
    typeof light.dimming?.brightness === "number" &&
    Math.abs(light.dimming.brightness - FESTAVIA_BRIGHTNESS) <= 1 &&
    timedEffectStatus(light) === "no_effect" &&
    light.dynamics?.status === "none"
  );
}

function effectStateMatches(light, effect, expectedTint = null) {
  if (!commonStateMatches(light) || effectStatus(light) !== effect) {
    return false;
  }
  if (expectedTint === null) return true;
  return xyMatches(effectStatusParameters(light)?.color?.xy, expectedTint);
}

function staticStateMatches(light, expectedPointCount) {
  return (
    commonStateMatches(light) &&
    effectStatus(light) === "no_effect" &&
    light.gradient?.mode === "interpolated_palette" &&
    Array.isArray(light.gradient?.points) &&
    light.gradient.points.length === expectedPointCount
  );
}

function publicState(light) {
  return {
    on: light.on?.on === true,
    brightness:
      typeof light.dimming?.brightness === "number"
        ? light.dimming.brightness
        : null,
    effect: effectStatus(light),
    timedEffect: timedEffectStatus(light),
    dynamics: light.dynamics?.status ?? null,
    gradientMode: light.gradient?.mode ?? null,
    gradientPointCount: Array.isArray(light.gradient?.points)
      ? light.gradient.points.length
      : 0,
  };
}

function findTarget(response) {
  const matches = response.data.filter(
    (light) => light.metadata?.name === FESTAVIA_LIGHT_NAME,
  );
  if (matches.length !== 1) {
    throw new Error("Festavia light did not resolve uniquely.");
  }
  return matches[0];
}

function validateCandidate(value) {
  const candidate = asRecord(value, "Candidate");
  const unexpectedFields = Object.keys(candidate).filter(
    (field) => !CANDIDATE_FIELDS.has(field),
  );
  if (unexpectedFields.length > 0) {
    throw new Error("Candidate contains unsupported fields.");
  }
  if (
    typeof candidate.id !== "string" ||
    !candidate.id.trim() ||
    typeof candidate.observanceName !== "string" ||
    !candidate.observanceName.trim() ||
    typeof candidate.mode !== "string" ||
    typeof candidate.effect !== "string" ||
    !Array.isArray(candidate.palette) ||
    !Array.isArray(candidate.fallbackPalette)
  ) {
    throw new Error("Candidate is incomplete.");
  }
  return candidate;
}

export function createFestaviaController({
  request,
  sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  transitionWaitMs = FESTAVIA_TRANSITION_MS + 500,
  persistenceWaitMs = 30000,
}) {
  async function inspectTarget() {
    return findTarget(await request("GET", "/clip/v2/resource/light"));
  }

  async function putTarget(target, body) {
    await request("PUT", `/clip/v2/resource/light/${target.id}`, body);
  }

  async function applyStatic(candidate, target, palette, fallbackReason = null) {
    const normalizedPalette = validatePalette(palette, "palette");
    const body = buildStaticGradientPayload(
      normalizedPalette,
      target.color?.gamut,
    );
    await putTarget(target, body);
    await sleep(transitionWaitMs);
    const verified = await inspectTarget();
    if (!staticStateMatches(verified, normalizedPalette.length)) {
      throw new Error("Static Festavia treatment could not be verified.");
    }
    return {
      operation: "apply",
      ok: true,
      candidateId: candidate.id,
      observanceName: candidate.observanceName,
      mode: fallbackReason ? "Static gradient" : candidate.mode,
      effect: "no_effect",
      palette: normalizedPalette,
      brightness: verified.dimming.brightness,
      fallbackUsed: Boolean(fallbackReason),
      substitutionNote: fallbackReason,
      state: publicState(verified),
    };
  }

  async function applyEffect(candidate, target) {
    if (!effectValues(target).includes(candidate.effect)) {
      throw new Error("Candidate effect is not currently supported.");
    }
    const normalizedPalette = validateEffectPalette(candidate.palette);
    if (
      normalizedPalette.length === 1 &&
      !effectColorValues(target).includes(candidate.effect)
    ) {
      throw new Error(
        "Candidate effect does not support a verified custom color.",
      );
    }
    const tint = normalizedPalette[0] ?? null;
    const expectedTint = tint ? hexToGamutXy(tint.hex, target.color?.gamut) : null;
    const fallbackPalette = validatePalette(
      candidate.fallbackPalette,
      "fallbackPalette",
    );
    if (
      timedEffectStatus(target) !== "no_effect" ||
      target.dynamics?.status !== "none"
    ) {
      throw new Error("Festavia has another active timed or dynamic treatment.");
    }

    try {
      await putTarget(
        target,
        buildEffectPayload(candidate.effect, tint, target.color?.gamut),
      );
      await sleep(transitionWaitMs);
      const firstRead = await inspectTarget();
      if (!effectStateMatches(firstRead, candidate.effect, expectedTint)) {
        throw new Error("effect readback mismatch");
      }
      await sleep(persistenceWaitMs);
      const persistentRead = await inspectTarget();
      if (!effectStateMatches(persistentRead, candidate.effect, expectedTint)) {
        throw new Error("effect did not remain active");
      }
      return {
        operation: "apply",
        ok: true,
        candidateId: candidate.id,
        observanceName: candidate.observanceName,
        mode: "Hue effect",
        effect: candidate.effect,
        palette: normalizedPalette,
        brightness: persistentRead.dimming.brightness,
        fallbackUsed: false,
        substitutionNote: null,
        state: publicState(persistentRead),
      };
    } catch {
      const current = await inspectTarget();
      return applyStatic(
        candidate,
        current,
        fallbackPalette,
        `${candidate.effect} did not remain active; applied the candidate's static fallback.`,
      );
    }
  }

  return {
    async inspect() {
      const target = await inspectTarget();
      return {
        operation: "inspect",
        ok: true,
        targetCount: 1,
        name: FESTAVIA_LIGHT_NAME,
        state: publicState(target),
        gradient: {
          pointsCapable: target.gradient?.points_capable ?? null,
          pixelCount: target.gradient?.pixel_count ?? null,
          modeValues: target.gradient?.mode_values ?? [],
        },
        effectValues: effectValues(target),
        effectColorValues: effectColorValues(target),
        effectStatusParameters: publicEffectStatusParameters(target),
      };
    },

    async apply(value) {
      const candidate = validateCandidate(value);
      const target = await inspectTarget();
      if (candidate.mode === "Hue effect") {
        return applyEffect(candidate, target);
      }
      if (STATIC_MODES.has(candidate.mode)) {
        if (candidate.effect !== "no_effect") {
          throw new Error("Static candidate requested an effect.");
        }
        return applyStatic(candidate, target, candidate.palette);
      }
      throw new Error("Candidate mode is unsupported.");
    },
  };
}
