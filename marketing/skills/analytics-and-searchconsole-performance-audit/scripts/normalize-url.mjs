/**
 * Normalize URLs for join keys across GSC and GA4 exports.
 */

export function normalizeUrl(raw, domain) {
  if (!raw || typeof raw !== "string") {
    return null;
  }

  let url = raw.trim();
  if (!url) {
    return null;
  }

  // GA4 sometimes exports path-only landing pages.
  if (url.startsWith("/") && domain) {
    url = `https://${stripWww(domain)}${url}`;
  }

  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    parsed.hash = "";
    let pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    parsed.pathname = pathname;
    parsed.protocol = "https:";
    // Canonical host: prefer non-www for join stability when domain given.
    if (domain) {
      const host = stripWww(parsed.hostname);
      const expected = stripWww(domain);
      if (host === expected || host === `www.${expected}`) {
        parsed.hostname = expected;
      }
    } else {
      parsed.hostname = stripWww(parsed.hostname);
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function stripWww(host) {
  return String(host || "")
    .replace(/^www\./i, "")
    .toLowerCase();
}

export function urlPath(url) {
  try {
    return new URL(url).pathname.toLowerCase();
  } catch {
    return "";
  }
}
