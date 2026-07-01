/**
 * Re-audit: snapshot load/save, before/after delta, encouragement, partial-fix downsides.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  GAP_REGISTRY,
  collectGapsFromAssessment,
  gapsToSnapshot
} from "./audit-gap-registry.mjs";
import { normalizeDomain } from "./assess-policy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const skillRoot = path.resolve(__dirname, "..");

/**
 * @param {string} domain
 * @param {import("./assess-policy.mjs").assessRobotsTxtContent extends (...args: any) => infer R ? R["assessment"] : never} assessment
 * @param {object} meta
 */
export function buildAuditSnapshot(domain, assessment, meta = {}) {
  const gaps = collectGapsFromAssessment(assessment);
  const snap = gapsToSnapshot(gaps);
  return {
    snapshot_version: "1.0",
    skill: "robots-txt-audit",
    domain: normalizeDomain(domain),
    audited_at: meta.audited_at ?? new Date().toISOString(),
    crawl_policy: assessment.crawl_policy ?? meta.crawl_policy,
    deployment: assessment.deployment?.model ?? meta.deployment,
    compliant: assessment.policy_compliance?.compliant === true,
    ...snap,
    detail_path: meta.detail_path ?? null
  };
}

/**
 * @param {string} domain
 * @param {string} [outputDir]
 */
export function latestSnapshotPath(domain, outputDir) {
  const bare = normalizeDomain(domain);
  const dir = outputDir ?? path.join(skillRoot, "reports");
  return path.join(dir, `${bare}-latest-snapshot.json`);
}

/**
 * @param {string} domain
 * @param {object} snapshot
 * @param {string} [outputDir]
 */
export function saveAuditSnapshot(domain, snapshot, outputDir) {
  const dir = outputDir ?? path.join(skillRoot, "reports");
  const filePath = latestSnapshotPath(domain, dir);
  writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return filePath;
}

/**
 * @param {string} domain
 * @param {string} [outputDir]
 */
export function loadPriorSnapshot(domain, outputDir) {
  const filePath = latestSnapshotPath(domain, outputDir);
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * @param {object} priorSnapshot
 * @param {{ required: object[], optional: object[] }} currentGaps
 */
export function compareGapSnapshots(priorSnapshot, currentGaps) {
  const priorRequired = new Set(priorSnapshot.required_ids ?? []);
  const priorOptional = new Set(priorSnapshot.optional_ids ?? []);
  const currentRequiredIds = new Set(currentGaps.required.map((g) => g.id));
  const currentOptionalIds = new Set(currentGaps.optional.map((g) => g.id));

  const fixedRequired = [...priorRequired].filter((id) => !currentRequiredIds.has(id));
  const fixedOptional = [...priorOptional].filter((id) => !currentOptionalIds.has(id));
  const stillRequired = currentGaps.required;
  const stillOptional = currentGaps.optional;
  const newRequired = currentGaps.required.filter((g) => !priorRequired.has(g.id));
  const newOptional = currentGaps.optional.filter((g) => !priorOptional.has(g.id));

  const priorRequiredCount = priorRequired.size;
  const fixedRequiredCount = fixedRequired.length;

  return {
    fixedRequired: fixedRequired.map((id) => ({ id, ...GAP_REGISTRY[id] })).filter((g) => g.label),
    fixedOptional: fixedOptional.map((id) => ({ id, ...GAP_REGISTRY[id] })).filter((g) => g.label),
    stillRequired,
    stillOptional,
    newRequired,
    newOptional,
    priorRequiredCount,
    fixedRequiredCount,
    allRequiredFixed: stillRequired.length === 0 && priorRequiredCount > 0,
    noChangeDetected:
      fixedRequiredCount === 0 &&
      newRequired.length === 0 &&
      stillRequired.length === priorRequiredCount &&
      priorRequiredCount > 0
  };
}

/**
 * @param {ReturnType<typeof compareGapSnapshots>} delta
 * @param {boolean} [isCloudflare]
 */
export function buildEncouragement(delta, isCloudflare = false) {
  if (delta.allRequiredFixed) {
    return "You nailed it — every **required** item from your last check is now in place. Nice work.";
  }
  if (delta.fixedRequiredCount > 0) {
    const total = delta.priorRequiredCount;
    const n = delta.fixedRequiredCount;
    const left = delta.stillRequired.length;
    if (left === 0) {
      return `Strong progress — you cleared all ${n} required item${n === 1 ? "" : "s"} we flagged last time.`;
    }
    if (left === 1) {
      return `Good momentum — you fixed ${n} of ${total} required items. **Almost there** — just one left.`;
    }
    return `Good progress — you fixed ${n} of ${total} required items since last check. Keep going.`;
  }
  if (delta.noChangeDetected) {
    if (isCloudflare) {
      return "The live file still matches the previous gaps — if you just published, wait a few minutes for Cloudflare to merge origin changes, then check again in a private browser window.";
    }
    return "The live file still shows the same required gaps — double-check that your host saved the file and that you are viewing the public URL, not a cached copy.";
  }
  if (delta.priorRequiredCount === 0 && delta.stillRequired.length === 0) {
    return "Still looking good — no new required gaps since last time.";
  }
  if (delta.newRequired.length > 0) {
    return "Something new showed up since last check — see **New since last time** below.";
  }
  return "Here is how your site compares to the last check.";
}

/**
 * @param {{ id: string, downside: string }[]} gaps
 */
export function buildPartialFixDownsides(gaps) {
  if (!gaps.length) {
    return null;
  }
  const lines = gaps.map((g) => `- **${GAP_REGISTRY[g.id]?.short ?? g.id}** — ${g.downside}`);
  const intro =
    gaps.length === 1
      ? "If you stop with this one item still open:"
      : `If you stop with these ${gaps.length} items still open:`;
  return `${intro}\n\n${lines.join("\n")}`;
}

/**
 * @param {object} params
 */
export function buildReauditProgressTable(priorSnapshot, currentGaps, delta) {
  const allIds = new Set([
    ...(priorSnapshot.required_ids ?? []),
    ...(priorSnapshot.optional_ids ?? []),
    ...currentGaps.required.map((g) => g.id),
    ...currentGaps.optional.map((g) => g.id)
  ]);

  const rows = [];
  for (const id of allIds) {
    const meta = GAP_REGISTRY[id];
    if (!meta) {
      continue;
    }
    const wasRequired = (priorSnapshot.required_ids ?? []).includes(id);
    const wasOptional = (priorSnapshot.optional_ids ?? []).includes(id);
    const isRequired = currentGaps.required.some((g) => g.id === id);
    const isOptional = currentGaps.optional.some((g) => g.id === id);
    if (!wasRequired && !wasOptional && !isRequired && !isOptional) {
      continue;
    }

    const before = wasRequired || wasOptional ? "❌" : "—";
    const now = isRequired || isOptional ? "❌" : wasRequired || wasOptional ? "✅" : "—";
    if (before === "—" && now === "—") {
      continue;
    }
    rows.push(`| ${meta.short} | ${before} | ${now} |`);
  }

  if (!rows.length) {
    return null;
  }

  return ["| Item | Last check | Now |", "|------|------------|-----|", ...rows].join("\n");
}

/**
 * @param {object} params
 */
export function buildReauditSummarySections({
  domain,
  priorSnapshot,
  currentGaps,
  delta,
  isCloudflare
}) {
  const encouragement = buildEncouragement(delta, isCloudflare);
  const table = buildReauditProgressTable(priorSnapshot, currentGaps, delta);
  const sections = [];

  sections.push("## Progress since last check", "", encouragement, "");

  if (table) {
    sections.push(table, "");
  }

  if (delta.fixedRequired.length || delta.fixedOptional.length) {
    sections.push("## Fixed — nice work", "");
    for (const g of delta.fixedRequired) {
      sections.push(`- ✅ ${g.short}`);
    }
    for (const g of delta.fixedOptional) {
      sections.push(`- ✅ ${g.short} _(optional)_`);
    }
    sections.push("");
  }

  if (delta.stillRequired.length) {
    sections.push("## Still to do", "");
    for (const g of delta.stillRequired) {
      sections.push(`- ${g.label}`);
      sections.push(`  - _Why it matters:_ ${g.downside}`);
    }
    sections.push("");
  } else if (delta.allRequiredFixed) {
    sections.push("## Still to do", "", "- Nothing required — you're in good shape.", "");
  }

  if (delta.newRequired.length || delta.newOptional.length) {
    sections.push("## New since last time", "");
    for (const g of delta.newRequired) {
      sections.push(`- ${g.label}`);
    }
    for (const g of delta.newOptional) {
      sections.push(`- ${g.label} _(optional)_`);
    }
    sections.push("");
  }

  if (delta.stillOptional.length) {
    sections.push("## Optional (unchanged or still open)", "");
    for (const g of delta.stillOptional) {
      sections.push(`- ${g.label}`);
    }
    sections.push("");
  }

  const partial = buildPartialFixDownsides(delta.stillRequired);
  if (partial) {
    sections.push("## If you stop here", "", partial, "");
  }

  return sections.join("\n");
}

/**
 * Find most recent detail report for domain (fallback when snapshot missing).
 * @param {string} domain
 * @param {string} [outputDir]
 */
export function findLatestDetailReport(domain, outputDir) {
  const bare = normalizeDomain(domain);
  const dir = outputDir ?? path.join(skillRoot, "reports");
  if (!existsSync(dir)) {
    return null;
  }
  const matches = readdirSync(dir)
    .filter((name) => name.startsWith(`${bare}-`) && name.endsWith("-detail.md"))
    .sort()
    .reverse();
  return matches.length ? path.join(dir, matches[0]) : null;
}
