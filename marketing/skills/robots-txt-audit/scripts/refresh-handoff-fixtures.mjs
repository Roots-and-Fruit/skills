#!/usr/bin/env node
/**
 * Regenerate handoff fixtures from HANDOFF_FIXTURE_MANIFEST + buildHandoff().
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assessRobotsTxtContent } from "./assess-policy.mjs";
import { buildHandoff, buildDiscovery } from "./build-handoff.mjs";
import { buildStandaloneDiscoveryDraft } from "./build-recommended-robots.mjs";
import { HANDOFF_FIXTURE_MANIFEST } from "./handoff-fixture-manifest.mjs";
import { parseRobotsTxt } from "./parse-robots-txt.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const examplesDir = path.join(root, "examples");

for (const entry of HANDOFF_FIXTURE_MANIFEST) {
  const outPath = path.join(examplesDir, entry.handoffFile);

  if (entry.generate) {
    const draft = buildStandaloneDiscoveryDraft(entry.domain);
    const assessOptions = {
      sitemap_fetch_results: [
        { url: `https://${entry.domain}/sitemap.xml`, status: 200 }
      ]
    };
    const { assessment } = assessRobotsTxtContent(
      draft,
      entry.policy,
      entry.domain,
      assessOptions
    );
    const parsed = parseRobotsTxt(draft);
    const handoff = buildHandoff({
      assessment,
      parsed,
      inputs: {
        domain: entry.domain,
        key_pages: entry.keyPages,
        crawl_policy: entry.policy
      },
      discovery: buildDiscovery({ domain: entry.domain, found: false }),
      draft_robots_txt: draft,
      deployment_note:
        "Save as robots.txt at the site root so it resolves to https://example.com/robots.txt. Test with GSC URL Inspection and Bing robots tester; monitor crawler logs for 48 hours.",
      limitations: [
        "Generated from policy template — verify user-agent tokens against provider docs before production"
      ]
    });
    writeFileSync(outPath, `${JSON.stringify(handoff, null, 2)}\n`);
    continue;
  }

  const content = entry.robotsContent
    ? entry.robotsContent
    : readFileSync(path.join(examplesDir, entry.robotsFile), "utf8");

  const { assessment, parsed } = assessRobotsTxtContent(
    content,
    entry.policy,
    entry.domain,
    entry.assessOptions ?? {}
  );

  const handoff = buildHandoff({
    assessment,
    parsed,
    inputs: {
      domain: entry.domain,
      key_pages: entry.keyPages,
      crawl_policy: entry.policy,
      ...(entry.robots_deployment ? { robots_deployment: entry.robots_deployment } : {})
    },
    discovery: buildDiscovery({
      domain: entry.domain,
      found: true,
      resolved_url: entry.resolvedUrl
    }),
    modeOverride: entry.modeOverride,
    deployment_note: entry.deployment_note,
    limitations: entry.limitations ?? []
  });

  writeFileSync(outPath, `${JSON.stringify(handoff, null, 2)}\n`);
}

console.log("Handoff fixtures updated.");
