/**
 * Parse robots.txt into structured groups (SSOT for structure checks).
 *
 * Usage:
 *   node scripts/parse-robots-txt.mjs examples/example-good.robots.txt.fixture.txt
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
