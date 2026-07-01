/**
 * Build copy-paste recommended robots.txt from audit result.
 */
import { buildCloudflareOriginAppend } from "./content-signals-presets.mjs";
import { normalizeDomain } from "./assess-policy.mjs";

const TEMPLATE_DISALLOWS = new Set(["/wp-admin/", "/cart/", "/checkout/"]);

/**
 * Succinct Cloudflare-managed update guidance (SSOT for chat output).
 * @param {string} domain
 * @returns {string[]}
 */
export function buildCloudflareUpdateGuidance(domain) {
  const bare = normalizeDomain(domain);
  return [
    `**Dashboard** — Keep “Instruct AI bot traffic with robots.txt” ON (Security → Bots). Training-bot blocks live here, not on your server.`,
    `**SFTP / host** — A tiny origin file is normal. Edit that file only; do not paste the Cloudflare block from the public URL.`,
    `**Verify** — Confirm at https://${bare}/robots.txt in a private window (edge = Cloudflare prepend + your origin file).`
  ];
}

/**
 * @param {string} domain
 */
export function buildCloudflarePasteNote(domain) {
  const bare = normalizeDomain(domain);
  return `Paste the **origin-only** block below into your server file (SFTP/host). Cloudflare prepends the managed section at the edge — do not upload the merged public file. Confirm at https://${bare}/robots.txt.`;
}

/**
 * Text to show in the copy-paste fenced block.
 * @param {{ text: string, originOnly?: string, isCloudflareManaged?: boolean }} recommended
 */
export function recommendedRobotsPasteText(recommended) {
  if (recommended.isCloudflareManaged && recommended.originOnly) {
    return recommended.originOnly.trim();
  }
  return recommended.text.trim();
}

/**
 * @param {string} originRaw
 * @returns {string[]}
 */
export function collectPreservedDisallows(originRaw) {
  const extras = [];
  if (!originRaw) {
    return extras;
  }
  for (const line of originRaw.split("\n")) {
    const match = line.match(/^\s*Disallow:\s*(.+)\s*$/i);
    if (!match) {
      continue;
    }
    const rulePath = match[1].trim();
    if (!TEMPLATE_DISALLOWS.has(rulePath) && rulePath !== "/") {
      extras.push(rulePath);
    }
  }
  return [...new Set(extras)];
}

/**
 * @param {string} template
 * @param {string[]} extras
 */
export function injectPreservedDisallows(template, extras) {
  if (!extras.length) {
    return template;
  }
  const lines = template.split("\n");
  const starIdx = lines.findIndex((line) => /^\s*User-agent:\s*\*\s*$/i.test(line));
  const insert = extras.map((rulePath) => `Disallow: ${rulePath}`);

  if (starIdx === -1) {
    return `${template.trimEnd()}\n${insert.join("\n")}`;
  }

  let allowIdx = -1;
  for (let i = starIdx + 1; i < lines.length; i++) {
    if (/^\s*User-agent:/i.test(lines[i])) {
      break;
    }
    if (/^\s*Allow:\s*\/\s*$/i.test(lines[i])) {
      allowIdx = i;
      break;
    }
  }

  if (allowIdx === -1) {
    let insertAt = starIdx + 1;
    for (let i = starIdx + 1; i < lines.length; i++) {
      if (/^\s*User-agent:/i.test(lines[i])) {
        break;
      }
      if (/^\s*Disallow:/i.test(lines[i])) {
        insertAt = i + 1;
      }
      if (/^\s*Sitemap:/i.test(lines[i])) {
        break;
      }
    }
    lines.splice(insertAt, 0, ...insert);
  } else {
    lines.splice(allowIdx, 0, ...insert);
  }

  return lines.join("\n");
}

/**
 * @param {string} domain
 * @param {{ sitemap_url?: string, preserved_disallows?: string[], crawl_policy?: string }} [options]
 */
export function buildStandaloneMaxDiscoveryDraft(domain, options = {}) {
  const bare = normalizeDomain(domain);
  const sitemapUrl = options.sitemap_url ?? `https://${bare}/sitemap.xml`;
  const extras = options.preserved_disallows ?? [];
  const lines = [
    "# Recommended robots.txt — max_discovery",
    "",
    "User-agent: GPTBot",
    "Disallow: /",
    "",
    "User-agent: Google-Extended",
    "Disallow: /",
    "",
    "User-agent: CCBot",
    "Disallow: /",
    "",
    "User-agent: OAI-SearchBot",
    "Allow: /",
    "",
    "User-agent: PerplexityBot",
    "Allow: /",
    "",
    "User-agent: Googlebot",
    "Allow: /",
    "",
    "User-agent: bingbot",
    "Allow: /",
    "",
    "User-agent: *",
    "Disallow: /wp-admin/",
    "Disallow: /cart/",
    "Disallow: /checkout/"
  ];
  for (const rulePath of extras) {
    lines.push(`Disallow: ${rulePath}`);
  }
  lines.push("Allow: /", "", `Sitemap: ${sitemapUrl}`);
  return lines.join("\n");
}

/**
 * @param {ReturnType<import("./assess-policy.mjs").assessRobotsTxtContent>["assessment"]} assessment
 * @param {string} domain
 * @param {string[]} preservedDisallows
 */
export function buildChangesList(assessment, domain, preservedDisallows = []) {
  const changes = [];
  const violations = assessment.policy_compliance?.violations ?? [];
  const hasSitemapPresent = violations.some((v) => v.id === "MD_SITEMAP_PRESENT");
  const hasSitemapValid = violations.some((v) => v.id === "MD_SITEMAP_VALID");

  if (hasSitemapPresent || hasSitemapValid) {
    changes.push(
      `Add Sitemap: https://${normalizeDomain(domain)}/sitemap.xml (change the URL if your sitemap lives elsewhere)`
    );
  }

  const pathIds = new Set(violations.filter((v) => v.id.startsWith("MD_PATH_")).map((v) => v.id));
  const pathBlocks = [];
  if (pathIds.has("MD_PATH__admin_")) {
    pathBlocks.push("/wp-admin/");
  }
  if (pathIds.has("MD_PATH__cart_")) {
    pathBlocks.push("/cart/");
  }
  if (pathIds.has("MD_PATH__checkout_")) {
    pathBlocks.push("/checkout/");
  }
  if (pathBlocks.length === 1) {
    changes.push(`Block ${pathBlocks[0]}`);
  } else if (pathBlocks.length > 1) {
    changes.push(`Block ${pathBlocks.slice(0, -1).join(", ")} and ${pathBlocks.at(-1)}`);
  }

  for (const rulePath of preservedDisallows) {
    changes.push(`Keep existing rule: Disallow: ${rulePath}`);
  }

  return changes;
}

/**
 * @param {string} robotsContent
 * @param {ReturnType<import("./assess-policy.mjs").assessRobotsTxtContent>} result
 * @param {string} domain
 */
export function buildRecommendedRobotsTxt(robotsContent, result, domain) {
  const { layers, deployment_model, assessment } = result;
  const deployment = assessment.deployment?.model ?? deployment_model;
  const compliant = assessment.policy_compliance?.compliant === true;
  const missingRequired = (assessment.policy_compliance?.violations ?? []).length > 0;

  if (compliant && !missingRequired) {
    return null;
  }

  const existingOrigin = layers?.origin?.raw ?? robotsContent;
  const preserved = collectPreservedDisallows(existingOrigin);
  let originRecommended = "";
  let pasteNote =
    "Replace your current robots.txt with the file below (or merge into your host’s robots.txt editor).";

  if (deployment === "cloudflare_managed" && assessment.origin_append_template) {
    originRecommended = injectPreservedDisallows(assessment.origin_append_template, preserved);
    const cfBlock = layers?.cloudflare?.raw?.trimEnd() ?? "";
    const fullMerged = cfBlock ? `${cfBlock}\n\n${originRecommended.trim()}` : originRecommended;
    pasteNote = buildCloudflarePasteNote(domain);
    return {
      text: fullMerged,
      originOnly: originRecommended,
      isCloudflareManaged: true,
      pasteNote,
      cfUpdateGuidance: buildCloudflareUpdateGuidance(domain),
      preserved,
      changes: buildChangesList(assessment, domain, preserved)
    };
  }

  if (assessment.origin_append_template) {
    originRecommended = injectPreservedDisallows(assessment.origin_append_template, preserved);
    return {
      text: originRecommended,
      originOnly: originRecommended,
      pasteNote,
      preserved,
      changes: buildChangesList(assessment, domain, preserved)
    };
  }

  if (assessment.crawl_policy === "max_discovery" || assessment.crawl_policy === "block_training_allow_answers") {
    const draft = buildStandaloneMaxDiscoveryDraft(domain, {
      preserved_disallows: preserved,
      crawl_policy: assessment.crawl_policy
    });
    return {
      text: draft,
      originOnly: draft,
      pasteNote,
      preserved,
      changes: buildChangesList(assessment, domain, preserved)
    };
  }

  return null;
}
