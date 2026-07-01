/**
 * Parse robots.txt into structured groups (SSOT for structure checks).
 *
 * Usage:
 *   node scripts/parse-robots-txt.mjs examples/example-good.robots.txt.fixture.txt
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLOUDFLARE_MANAGED_MARKERS } from "./crawler-registry-cloudflare.mjs";

export function pathToRegex(pattern) {
  if (pattern === "") {
    return null;
  }

  let source = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");

  if (pattern.endsWith("$")) {
    source = source.slice(0, -2) + "$";
    return new RegExp(source);
  }

  return new RegExp(`^${source}`);
}

export function getEffectiveRule(rules, pathname) {
  let bestMatch = null;
  let bestLen = -1;

  for (const rule of rules) {
    if (rule.path === "") {
      if (rule.type === "disallow") {
        const candidate = { ...rule, matchLen: 0 };
        if (bestLen <= 0) {
          bestMatch = candidate;
          bestLen = 0;
        }
      }
      continue;
    }

    const regex = pathToRegex(rule.path);
    if (regex && regex.test(pathname) && rule.path.length > bestLen) {
      bestMatch = { ...rule, matchLen: rule.path.length };
      bestLen = rule.path.length;
    }
  }

  return bestMatch;
}

export function findGroupForAgent(groups, userAgent) {
  const ua = userAgent.toLowerCase();
  const exact = groups.find((group) =>
    group.userAgents.some((agent) => agent.toLowerCase() === ua)
  );
  if (exact) {
    return exact;
  }

  return groups.find((group) =>
    group.userAgents.some((agent) => agent === "*")
  );
}

export function isPathAllowedForAgent(groups, userAgent, pathname) {
  const group = findGroupForAgent(groups, userAgent);
  if (!group) {
    return true;
  }

  const rule = getEffectiveRule(group.rules, pathname);
  if (!rule) {
    return true;
  }

  if (rule.type === "allow") {
    return true;
  }

  if (rule.type === "disallow") {
    return rule.path === "";
  }

  return true;
}

/**
 * Parse Content-Signal directives from managed block text.
 * @param {string} text
 */
export function parseContentSignals(text) {
  const signals = { search: null, ai_input: null, ai_train: null };
  const match = text.match(/Content-Signal:\s*([^\n#]+)/i);
  if (!match) {
    return signals;
  }

  for (const part of match[1].split(",")) {
    const [key, value] = part.trim().split("=").map((s) => s.trim());
    if (!key || !value) {
      continue;
    }
    const normalized = key.toLowerCase().replace(/-/g, "_");
    if (normalized in signals) {
      signals[normalized] = value.toLowerCase();
    }
  }

  return signals;
}

/**
 * Detect Cloudflare managed robots.txt prepend in edge-served content.
 * @param {string} content
 */
export function detectCloudflareManaged(content) {
  const begin = CLOUDFLARE_MANAGED_MARKERS.begin.test(content);
  const end = CLOUDFLARE_MANAGED_MARKERS.end.test(content);
  return begin && end;
}

/**
 * Split edge-served robots.txt into Cloudflare managed vs origin layers.
 * @param {string} content
 */
export function parseRobotsTxtLayers(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  let beginIndex = -1;
  let endIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (beginIndex === -1 && CLOUDFLARE_MANAGED_MARKERS.begin.test(lines[i])) {
      beginIndex = i;
    }
    if (CLOUDFLARE_MANAGED_MARKERS.end.test(lines[i])) {
      endIndex = i;
    }
  }

  const detected = beginIndex !== -1 && endIndex !== -1 && endIndex > beginIndex;

  if (!detected) {
    const effective = parseRobotsTxt(content);
    return {
      detected: false,
      markers: null,
      cloudflare: null,
      origin: { raw: content, parsed: effective },
      effective,
      content_signals: parseContentSignals(content)
    };
  }

  const cloudflareRaw = lines.slice(0, endIndex + 1).join("\n");
  const originRaw = lines.slice(endIndex + 1).join("\n").trim();
  const cloudflareParsed = parseRobotsTxt(cloudflareRaw);
  const originParsed = parseRobotsTxt(originRaw.length > 0 ? originRaw : "");
  const effective = parseRobotsTxt(content);

  return {
    detected: true,
    markers: {
      begin: lines[beginIndex].trim(),
      end: lines[endIndex].trim()
    },
    cloudflare: {
      raw: cloudflareRaw,
      parsed: cloudflareParsed
    },
    origin: {
      raw: originRaw,
      parsed: originParsed
    },
    effective,
    content_signals: parseContentSignals(cloudflareRaw)
  };
}

export function parseRobotsTxt(content) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const groups = [];
  const sitemaps = [];
  const crawlDelays = [];
  let currentGroup = null;

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0].trim();
    if (!line) {
      continue;
    }

    const colon = line.indexOf(":");
    if (colon === -1) {
      continue;
    }

    const directive = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (directive === "user-agent") {
      if (currentGroup && currentGroup.rules.length > 0) {
        currentGroup = { userAgents: [value], rules: [] };
        groups.push(currentGroup);
      } else if (!currentGroup) {
        currentGroup = { userAgents: [value], rules: [] };
        groups.push(currentGroup);
      } else {
        currentGroup.userAgents.push(value);
      }
      continue;
    }

    if (!currentGroup) {
      currentGroup = { userAgents: ["*"], rules: [] };
      groups.push(currentGroup);
    }

    if (directive === "allow" || directive === "disallow") {
      currentGroup.rules.push({ type: directive, path: value });
    } else if (directive === "sitemap") {
      sitemaps.push(value);
    } else if (directive === "crawl-delay") {
      crawlDelays.push({ userAgents: [...currentGroup.userAgents], delay: value });
    }
  }

  const userAgentTokens = [
    ...new Set(groups.flatMap((group) => group.userAgents))
  ];

  return {
    groups,
    sitemaps,
    crawlDelays,
    userAgentTokens,
    groupCount: groups.length,
    ruleCount: groups.reduce((sum, group) => sum + group.rules.length, 0)
  };
}

export function urlPathname(url) {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url.startsWith("/") ? url : `/${url}`;
  }
}

export function assessCrawlability(groups, keyPages, userAgents) {
  if (keyPages.length === 0) {
    return {
      key_pages_provided: 0,
      fully_crawlable: null,
      blocked_key_pages: []
    };
  }

  const blocked = [];

  for (const pageUrl of keyPages) {
    const pathname = urlPathname(pageUrl);
    const blockedBy = [];

    for (const agent of userAgents) {
      if (!isPathAllowedForAgent(groups, agent, pathname)) {
        blockedBy.push(agent);
      }
    }

    if (blockedBy.length > 0) {
      blocked.push({ url: pageUrl, pathname, blocked_by: blockedBy });
    }
  }

  return {
    key_pages_provided: keyPages.length,
    fully_crawlable: keyPages.length - blocked.length,
    blocked_key_pages: blocked
  };
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/parse-robots-txt.mjs <path-to-robots.txt>");
    process.exit(2);
  }

  const content = readFileSync(file, "utf8");
  console.log(JSON.stringify(parseRobotsTxt(content), null, 2));
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  main();
}
