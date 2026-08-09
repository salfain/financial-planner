// Coolify runs the frontend in Node.js. Routes backed by Apps Script do not
// use D1 or R2, but the shared route bundle still imports Cloudflare's env
// module. Expose ordinary runtime variables so Node can load that bundle.
export const env = process.env as Record<string, unknown>;
