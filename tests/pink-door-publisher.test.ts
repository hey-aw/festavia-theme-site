import assert from "node:assert/strict";
import test from "node:test";
import { verifiedWinnerResponse } from "../scripts/pink-door-publisher-lib.mjs";

const response = {
  date: "2026-08-26",
  closesAt: "2026-08-27T03:01:00.000Z",
  winner: {
    id: "winning-candidate",
    observanceName: "Winning Observance",
  },
};

test("winner response preserves the exact closed-poll payload", () => {
  assert.equal(
    verifiedWinnerResponse(response, response.date, new Date("2026-08-27T03:01:00.000Z")),
    response,
  );
});

test("winner response rejects an open poll", () => {
  assert.throws(
    () =>
      verifiedWinnerResponse(
        response,
        response.date,
        new Date("2026-08-27T03:00:59.999Z"),
      ),
    /still open/,
  );
});

test("winner response rejects mismatched dates and missing winners", () => {
  const afterClose = new Date("2026-08-27T03:02:00.000Z");
  assert.throws(
    () => verifiedWinnerResponse(response, "2026-08-25", afterClose),
    /date did not match/,
  );
  assert.throws(
    () => verifiedWinnerResponse({ ...response, winner: null }, response.date, afterClose),
    /winning candidate/,
  );
});
