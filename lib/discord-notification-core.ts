import type { ClaimedDiscordNotification } from "./discord-notification-types";

const DISCORD_API = "https://discord.com/api/v10";
const DELIVERY_TIMEOUT_MS = 8_000;

export const discordNotificationLeaseMilliseconds = 120_000;

export class DiscordNotificationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "DiscordNotificationError";
  }
}

export type DiscordNotificationSender = (
  content: string,
  nonce: string,
) => Promise<string>;

export type DiscordNotificationStore = {
  claimNext(now: Date, leaseMilliseconds: number): Promise<ClaimedDiscordNotification | null>;
  markDelivered(
    event: ClaimedDiscordNotification,
    messageId: string,
    deliveredAt: string,
  ): Promise<boolean>;
  release(event: ClaimedDiscordNotification, errorCode: string): Promise<boolean>;
};

export type DiscordNotificationDrainResult = {
  claimed: number;
  delivered: number;
  failed: number;
};

export function notificationNonce(eventId: string): string {
  return eventId.replaceAll("-", "").slice(0, 25);
}

export function notificationFailureCode(error: unknown): string {
  if (error instanceof DiscordNotificationError) return error.code;
  if (
    error instanceof DOMException &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return "DISCORD_TIMEOUT";
  }
  return "DISCORD_NETWORK";
}

async function discordJson(
  path: string,
  token: string,
  init: RequestInit,
  fetchImplementation: typeof fetch,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetchImplementation(`${DISCORD_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      signal: init.signal ?? AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
  } catch (error) {
    throw new DiscordNotificationError(notificationFailureCode(error));
  }
  if (!response.ok) {
    throw new DiscordNotificationError(`DISCORD_HTTP_${response.status}`);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new DiscordNotificationError("DISCORD_INVALID_RESPONSE");
  }
  if (typeof body !== "object" || body === null) {
    throw new DiscordNotificationError("DISCORD_INVALID_RESPONSE");
  }
  return body as Record<string, unknown>;
}

export async function sendDiscordDm(
  content: string,
  nonce: string,
  options: {
    botToken: string;
    recipientId: string;
    fetchImplementation?: typeof fetch;
  },
): Promise<string> {
  if (!content || content.length > 2_000) {
    throw new DiscordNotificationError("DISCORD_INVALID_CONTENT");
  }
  if (!nonce || nonce.length > 25) {
    throw new DiscordNotificationError("DISCORD_INVALID_NONCE");
  }
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const channel = await discordJson(
    "/users/@me/channels",
    options.botToken,
    {
      method: "POST",
      body: JSON.stringify({ recipient_id: options.recipientId }),
    },
    fetchImplementation,
  );
  if (typeof channel.id !== "string" || !channel.id) {
    throw new DiscordNotificationError("DISCORD_INVALID_CHANNEL");
  }
  const message = await discordJson(
    `/channels/${channel.id}/messages`,
    options.botToken,
    {
      method: "POST",
      body: JSON.stringify({
        content,
        allowed_mentions: { parse: [] },
        nonce,
        enforce_nonce: true,
      }),
    },
    fetchImplementation,
  );
  if (typeof message.id !== "string" || !message.id) {
    throw new DiscordNotificationError("DISCORD_INVALID_MESSAGE");
  }
  return message.id;
}

export async function drainDiscordNotificationBatch(options: {
  store: DiscordNotificationStore;
  sender: DiscordNotificationSender;
  render: (event: ClaimedDiscordNotification) => Promise<string>;
  now?: () => Date;
  limit?: number;
  logFailure?: (event: ClaimedDiscordNotification, code: string) => void;
}): Promise<DiscordNotificationDrainResult> {
  const now = options.now ?? (() => new Date());
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 10);
  const logFailure = options.logFailure ?? (() => undefined);
  const result: DiscordNotificationDrainResult = {
    claimed: 0,
    delivered: 0,
    failed: 0,
  };

  for (let index = 0; index < limit; index += 1) {
    const event = await options.store.claimNext(
      now(),
      discordNotificationLeaseMilliseconds,
    );
    if (!event) break;
    result.claimed += 1;
    try {
      const content = await options.render(event);
      const messageId = await options.sender(
        content,
        notificationNonce(event.eventId),
      );
      const marked = await options.store.markDelivered(
        event,
        messageId,
        now().toISOString(),
      );
      if (!marked) {
        throw new DiscordNotificationError("DELIVERY_CLAIM_LOST");
      }
      result.delivered += 1;
    } catch (error) {
      const code = notificationFailureCode(error);
      await options.store.release(event, code);
      logFailure(event, code);
      result.failed += 1;
    }
  }
  return result;
}
