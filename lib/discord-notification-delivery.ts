import {
  claimNextDiscordNotification,
  markDiscordNotificationDelivered,
  pollForDate,
  rankedPollResult,
  releaseDiscordNotificationClaim,
  voteNotificationDetails,
} from "./data";
import {
  DiscordNotificationError,
  drainDiscordNotificationBatch,
  sendDiscordDm,
  type DiscordNotificationStore,
} from "./discord-notification-core";
import {
  formatPollClosedNotification,
  formatPollOpenedNotification,
  formatVoteNotification,
  type PollNotificationResult,
} from "./discord-notification-format";
import type { ClaimedDiscordNotification } from "./discord-notification-types";
import { runtimeEnv } from "./runtime-env";

function configuration(): {
  botToken: string;
  recipientId: string;
  publicSiteUrl: string;
} {
  const environment = runtimeEnv();
  const botToken = environment.DISCORD_BOT_TOKEN?.trim() ?? "";
  const recipientId = environment.DISCORD_RECIPIENT_ID?.trim() ?? "";
  const configuredUrl = environment.PUBLIC_SITE_URL?.trim() ?? "";
  if (!botToken) throw new DiscordNotificationError("CONFIG_BOT_TOKEN");
  if (!/^\d{16,22}$/.test(recipientId)) {
    throw new DiscordNotificationError("CONFIG_RECIPIENT_ID");
  }

  let publicSiteUrl: URL;
  try {
    publicSiteUrl = new URL(configuredUrl);
  } catch {
    throw new DiscordNotificationError("CONFIG_PUBLIC_SITE_URL");
  }
  const localDevelopment =
    publicSiteUrl.protocol === "http:" && publicSiteUrl.hostname === "localhost";
  if (publicSiteUrl.protocol !== "https:" && !localDevelopment) {
    throw new DiscordNotificationError("CONFIG_PUBLIC_SITE_URL");
  }
  if (publicSiteUrl.username || publicSiteUrl.password) {
    throw new DiscordNotificationError("CONFIG_PUBLIC_SITE_URL");
  }
  return {
    botToken,
    recipientId,
    publicSiteUrl: publicSiteUrl.toString().replace(/\/$/, ""),
  };
}

function defaultStore(): DiscordNotificationStore {
  return {
    claimNext: claimNextDiscordNotification,
    markDelivered: (event, messageId, deliveredAt) =>
      markDiscordNotificationDelivered(
        event.eventId,
        event.claimToken,
        messageId,
        deliveredAt,
      ),
    release: (event, code) =>
      releaseDiscordNotificationClaim(event.eventId, event.claimToken, code),
  };
}

async function pollNotificationResult(
  date: string,
): Promise<PollNotificationResult> {
  const [poll, candidates] = await Promise.all([
    pollForDate(date),
    rankedPollResult(date),
  ]);
  if (!poll || !candidates[0] || !candidates[1]) {
    throw new DiscordNotificationError("NOTIFICATION_DATA_MISSING");
  }
  return {
    date,
    winner: {
      observanceName: candidates[0].observanceName,
      voteCount: candidates[0].voteCount,
    },
    alternate: {
      observanceName: candidates[1].observanceName,
      voteCount: candidates[1].voteCount,
    },
    totalVoteCount: candidates.reduce(
      (sum, candidate) => sum + candidate.voteCount,
      0,
    ),
  };
}

export async function renderDiscordNotification(
  event: ClaimedDiscordNotification,
  publicSiteUrl: string,
): Promise<string> {
  if (event.eventType === "vote_cast") {
    if (!event.candidateId) {
      throw new DiscordNotificationError("NOTIFICATION_DATA_MISSING");
    }
    const details = await voteNotificationDetails(event.date, event.candidateId);
    if (!details) {
      throw new DiscordNotificationError("NOTIFICATION_DATA_MISSING");
    }
    return formatVoteNotification(details);
  }

  const poll = await pollNotificationResult(event.date);
  return event.eventType === "poll_opened"
    ? formatPollOpenedNotification(poll, publicSiteUrl)
    : formatPollClosedNotification(poll);
}

export async function drainDiscordNotifications(): Promise<{
  claimed: number;
  delivered: number;
  failed: number;
}> {
  const configured = configuration();
  return drainDiscordNotificationBatch({
    store: defaultStore(),
    sender: (content, nonce) =>
      sendDiscordDm(content, nonce, {
        botToken: configured.botToken,
        recipientId: configured.recipientId,
      }),
    render: (event) =>
      renderDiscordNotification(event, configured.publicSiteUrl),
    logFailure: (event, code) => {
      console.error(
        JSON.stringify({
          event: "discord_notification_delivery_failed",
          eventId: event.eventId,
          eventType: event.eventType,
          code,
        }),
      );
    },
  });
}
