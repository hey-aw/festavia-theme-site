import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildEffectPayload,
  buildStaticGradientPayload,
  createCurlRequester,
  createFestaviaController,
  hexToGamutXy,
  parseOpenHueConfig,
} from "../scripts/festavia-hue-lib.mjs";

const gamut = {
  red: { x: 0.6915, y: 0.3083 },
  green: { x: 0.17, y: 0.7 },
  blue: { x: 0.1532, y: 0.0475 },
};

const fallbackPalette = [
  { name: "Vanilla", hex: "#FFF0C2" },
  { name: "Caramel", hex: "#D88A1D" },
  { name: "Amber", hex: "#FFB347" },
];

const effectCandidate = {
  id: "creme-brulee-candle",
  observanceName: "National Creme Brulee Day",
  mode: "Hue effect",
  effect: "candle",
  palette: [],
  fallbackPalette,
};

function light({
  effect = "no_effect",
  points = [],
  brightness = 75.1,
} = {}) {
  return {
    id: "private-light-id",
    metadata: { name: "Festavia permanent 1" },
    on: { on: true },
    dimming: { brightness },
    color: { gamut },
    gradient: {
      points_capable: 5,
      pixel_count: 48,
      mode_values: ["interpolated_palette"],
      mode: "interpolated_palette",
      points,
    },
    effects_v2: {
      action: { effect_values: ["no_effect", "candle", "prism"] },
      status: { effect },
    },
    timed_effects: { status: "no_effect" },
    dynamics: { status: "none" },
  };
}

function response(target) {
  return { errors: [], data: [target] };
}

test("OpenHue config parsing accepts quoted scalars and requires HTTPS", () => {
  assert.deepEqual(
    parseOpenHueConfig("bridge: \"192.168.4.32\"\nkey: 'secret-value'\n"),
    { bridgeUrl: "https://192.168.4.32", key: "secret-value" },
  );
  assert.throws(
    () => parseOpenHueConfig("bridge: http://192.168.4.32\nkey: value\n"),
    /invalid/,
  );
  assert.throws(
    () =>
      parseOpenHueConfig(
        "bridge: 192.168.4.32\nbridge: 192.168.4.33\nkey: value\n",
      ),
    /duplicate/,
  );
});

test("curl requester keeps the key and Hue resource path out of argv", async () => {
  let invocation;
  const request = createCurlRequester({
    bridgeUrl: "https://192.168.4.32",
    key: "private-key",
    execFile(file, args, options) {
      invocation = { file, args, options };
      return JSON.stringify({ errors: [], data: [] });
    },
  });

  await request(
    "PUT",
    "/clip/v2/resource/light/private-resource-id",
    buildEffectPayload("candle"),
  );
  assert.equal(invocation.file, "/usr/bin/curl");
  assert.deepEqual(invocation.args, ["--config", "-"]);
  assert.doesNotMatch(invocation.args.join(" "), /private-key|private-resource-id/);
  assert.match(invocation.options.input, /private-key/);
  assert.match(invocation.options.input, /private-resource-id/);
});

test("static payload converts and gamut-clips all palette colors", () => {
  const payload = buildStaticGradientPayload(fallbackPalette, gamut);
  assert.equal(payload.gradient.points.length, 3);
  assert.equal(payload.effects_v2.action.effect, "no_effect");
  assert.equal(payload.timed_effects.effect, "no_effect");
  for (const point of payload.gradient.points) {
    assert.ok(point.color.xy.x >= 0 && point.color.xy.x <= 1);
    assert.ok(point.color.xy.y >= 0 && point.color.xy.y <= 1);
  }
  assert.deepEqual(hexToGamutXy("#000000", gamut), {
    x: 0.3227,
    y: 0.329,
  });
});

test("effect application requires two persistent matching readbacks", async () => {
  const puts = [];
  let getCount = 0;
  const controller = createFestaviaController({
    sleep: async () => {},
    request: async (method, path, body) => {
      if (method === "PUT") {
        puts.push({ path, body });
        return response({});
      }
      getCount += 1;
      return response(
        light({ effect: getCount === 1 ? "no_effect" : "candle" }),
      );
    },
  });

  const result = await controller.apply(effectCandidate);
  assert.equal(result.mode, "Hue effect");
  assert.equal(result.effect, "candle");
  assert.equal(result.fallbackUsed, false);
  assert.equal(getCount, 3);
  assert.equal(puts.length, 1);
  assert.equal(puts[0].body.effects_v2.action.effect, "candle");
  assert.equal("timed_effects" in puts[0].body, false);
  assert.equal("dynamics" in puts[0].body, false);
});

test("effect that resets is replaced by the candidate static fallback", async () => {
  const puts = [];
  let getCount = 0;
  const controller = createFestaviaController({
    sleep: async () => {},
    request: async (method, path, body) => {
      if (method === "PUT") {
        puts.push({ path, body });
        return response({});
      }
      getCount += 1;
      if (getCount === 1) return response(light());
      if (getCount === 2) return response(light({ effect: "candle" }));
      if (getCount === 3) return response(light({ effect: "no_effect" }));
      const points = fallbackPalette.map(() => ({ color: { xy: {} } }));
      return response(light({ effect: "no_effect", points }));
    },
  });

  const result = await controller.apply(effectCandidate);
  assert.equal(result.mode, "Static gradient");
  assert.equal(result.effect, "no_effect");
  assert.equal(result.fallbackUsed, true);
  assert.match(result.substitutionNote, /did not remain active/);
  assert.equal(puts.length, 2);
  assert.equal(puts[1].body.effects_v2.action.effect, "no_effect");
  assert.equal(puts[1].body.gradient.points.length, fallbackPalette.length);
});

test("unsupported effects fail before changing the light", async () => {
  let putCount = 0;
  const controller = createFestaviaController({
    sleep: async () => {},
    request: async (method) => {
      if (method === "PUT") putCount += 1;
      return response(light());
    },
  });

  await assert.rejects(
    controller.apply({ ...effectCandidate, effect: "sunbeam" }),
    /not currently supported/,
  );
  assert.equal(putCount, 0);
});

test("target and unsafe state overrides are rejected before any PUT", async () => {
  let putCount = 0;
  const controller = createFestaviaController({
    sleep: async () => {},
    request: async (method) => {
      if (method === "PUT") putCount += 1;
      return response(light());
    },
  });

  await assert.rejects(
    controller.apply({
      ...effectCandidate,
      target: "another-light",
      timed_effects: { effect: "sunset" },
    }),
    /unsupported fields/,
  );
  assert.equal(putCount, 0);
});

test("automation prompts invoke the skill through the project adapter", async () => {
  const [candidatePrompt, observancePrompt] = await Promise.all([
    readFile(
      new URL(
        "../automations/daily-pink-door-theme-candidates.md",
        import.meta.url,
      ),
      "utf8",
    ),
    readFile(
      new URL(
        "../automations/daily-festavia-observance-theme.md",
        import.meta.url,
      ),
      "utf8",
    ),
  ]);

  for (const prompt of [candidatePrompt, observancePrompt]) {
    assert.match(prompt, /\$control-hue-lights/);
    assert.match(prompt, /scripts\/festavia-hue\.mjs` helper is authoritative/);
    assert.match(prompt, /node scripts\/festavia-hue\.mjs inspect/);
  }
  assert.match(candidatePrompt, /This is a read-only lighting run/);
  assert.match(
    observancePrompt,
    /node scripts\/festavia-hue\.mjs apply <candidate-path>/,
  );
  assert.match(observancePrompt, /two readbacks 30 seconds apart/);
});
