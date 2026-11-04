import { after } from "next/server";

import { isInboxConfigured } from "./inbox";
import { syncInbox } from "./tickets";

const REFRESH_EVERY_MS = 2 * 60 * 1000;
let lastRefresh = 0;

// Brings in new e-mails after the response, at most every 2 minutes per
// server instance, so the team's alert counts them without anyone opening
// the Atendimento and without slowing the page down.
export const refreshInboxSoon = () => {
  if (!isInboxConfigured() || Date.now() - lastRefresh < REFRESH_EVERY_MS) {
    return;
  }
  lastRefresh = Date.now();
  after(() =>
    syncInbox().catch((error) =>
      console.error("Support inbox not refreshed:", (error as Error).message),
    ),
  );
};
