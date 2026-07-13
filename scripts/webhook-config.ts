/**
 * Single source of truth for the webhook target URLs, shared by
 * set-webhook.ts (which repoints Stream) and dev-doctor.ts (which verifies
 * the current setup).
 */
export const NGROK_URL =
  "https://nonprojecting-uncharactered-dorene.ngrok-free.dev/api/webhook";
export const PROD_URL = "https://meeting-ai-saas1.vercel.app/api/webhook";
