/**
 * Normalizes dev base URL for Capacitor so the app opens native login flow.
 * @param {string} base e.g. http://10.0.2.2:3000 or https://xxx.ngrok-free.app
 */
function ensureNativeLoginUrl(base) {
  const trimmed = String(base).trim().replace(/\/$/, "");
  if (/\/prihlaseni(\?|$)/i.test(trimmed)) return trimmed;
  return `${trimmed}/prihlaseni?native=1`;
}

module.exports = { ensureNativeLoginUrl };
