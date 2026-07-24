# Pink Door vote notifications

Run every minute. Use the current calendar date in America/Los_Angeles.

1. Read this automation's memory first. Track event IDs that were sent to
   Discord but not yet acknowledged, and the most recent successful delivery.
   Never store Discord user IDs, chat IDs, bot credentials, publisher
   credentials, voter hashes, IP addresses, cookies, or private diagnostics.

2. Use the Discord for Codex plugin. Confirm `connection_status` reports the bot
   ready, the DM policy is `allowlist`, and exactly one sender is allowed.
   Resolve the sole approved DM chat from the local Discord for Codex approved
   marker without printing or storing its sender or chat ID. If the bot is not
   ready or the approved target is ambiguous, record a concise failure in
   memory and stop without acknowledging events.

3. From this project directory, retrieve pending first-vote events with:

   `node scripts/pink-door-publisher.mjs notifications <YYYY-MM-DD>`

   The helper reads the publisher credential from macOS Keychain and retries
   once. Never print or log the credential. Treat a rejected or malformed
   response as failure. Each returned event is public-safe and contains an
   event ID, date, candidate ID, observance name, current candidate vote count,
   current total vote count, closing timestamp, and creation timestamp.

4. If no events are pending, update memory with the successful no-op run and
   stop without sending a Discord message.

5. Process events oldest first. If an event ID is already recorded as sent but
   unacknowledged, skip directly to acknowledgment. Otherwise use the Discord
   for Codex `reply` tool to send one concise DM:

   ```
   New Pink Door vote
   Date: <YYYY-MM-DD>
   Choice: <observance name>
   Current tally: <candidate votes> for this choice, <total votes> total
   Voting closes: 5:50 PM Pacific
   ```

   Do not include event IDs, candidate IDs, Discord IDs, voter data, source
   addresses, credentials, or diagnostics. After a confirmed Discord send,
   immediately record the event ID in memory as sent but unacknowledged.

6. Write a temporary JSON payload containing only `{ "eventId": "..." }` and
   acknowledge the event with:

   `node scripts/pink-door-publisher.mjs ack-notification <YYYY-MM-DD> <payload-path>`

   Delete the temporary payload after the command completes. Treat a rejected
   or unverified response as failure. On verified acknowledgment, remove the
   event from the sent-but-unacknowledged memory set and record its successful
   delivery. Never resend an event that memory already records as sent.

7. Do not send Slack messages and do not change any Hue state. Record the run
   time, pending count, Discord delivery count, acknowledgment count, and any
   concise public-safe failure in automation memory.
