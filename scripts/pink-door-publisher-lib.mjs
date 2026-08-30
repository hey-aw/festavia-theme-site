export function verifiedWinnerResponse(result, expectedDate, now = new Date()) {
  if (!result || typeof result !== "object") {
    throw new Error("Winner response was invalid.");
  }
  if (result.date !== expectedDate) {
    throw new Error("Winner response date did not match the requested date.");
  }
  const closesAtMs = Date.parse(result.closesAt);
  if (!Number.isFinite(closesAtMs)) {
    throw new Error("Winner response did not include a valid poll close time.");
  }
  if (now.getTime() < closesAtMs) {
    throw new Error("Poll is still open.");
  }
  if (
    !result.winner ||
    typeof result.winner !== "object" ||
    typeof result.winner.id !== "string" ||
    typeof result.winner.observanceName !== "string"
  ) {
    throw new Error("Winner response did not include a valid winning candidate.");
  }
  return result;
}
