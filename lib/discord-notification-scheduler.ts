import { waitUntil } from "cloudflare:workers";
import { drainDiscordNotifications } from "./discord-notification-delivery";

export function scheduleDiscordNotificationDrain(): void {
  waitUntil(
    drainDiscordNotifications().catch(() => {
      console.error(
        JSON.stringify({
          event: "discord_notification_drain_failed",
          code: "DRAIN_FAILED",
        }),
      );
    }),
  );
}
