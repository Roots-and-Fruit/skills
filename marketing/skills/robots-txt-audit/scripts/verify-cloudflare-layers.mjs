#!/usr/bin/env node
/**
 * Regression checks for Cloudflare managed robots.txt layer splitting.
 *
 * Usage (from robots-txt-audit/):
 *   node scripts/verify-cloudflare-layers.mjs
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assessCloudflareLayer,
  assessMaxDiscovery,
  assessOriginLayer,
  assessRobotsTxtContent
} from "./assess-policy.mjs";
import {
  buildCloudflareOriginAppend,
  contentSignalsPresetForCrawlPolicy
} from "./content-signals-presets.mjs";
import {
  detectCloudflareManaged,
  parseRobotsTxtLayers
} from "./parse-robots-txt.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadFixture(name) {
  return readFileSync(path.join(root, "examples", name), "utf8");
}

function check(id, pass, detail = "") {
  console.log(pass ? `PASS ${id}` : `FAIL ${id}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

function main() {
  const cfFixture = loadFixture(
    "example-cloudflare-managed-origin-append.robots.txt.fixture.txt"
  );
  const goodFixture = loadFixture("example-good.robots.txt.fixture.txt");
  let failed = false;

  console.log("robots-txt-audit Cloudflare layer checks\n");

  const layers = parseRobotsTxtLayers(cfFixture);
  failed =
    !check("CF1", layers.detected, "CF markers not detected in fixture") || failed;
  failed =
    !check(
      "CF2",
      layers.cloudflare?.parsed.groupCount >= 8,
      `expected managed groups, got ${layers.cloudflare?.parsed.groupCount}`
    ) || failed;
  failed =
    !check(
      "CF3",
      layers.origin?.parsed.groupCount >= 1,
      "origin layer should have User-agent: * group"
    ) || failed;
  failed =
    !check(
      "CF4",
      layers.origin?.parsed.sitemaps.length === 0,
      "origin fixture has no sitemap"
    ) || failed;

  const cfLayer = assessCloudflareLayer(layers);
  failed =
    !check("CF5", cfLayer?.training_bots_blocked === true, "training bots not blocked in CF layer") ||
    failed;
  failed =
    !check("CF6", cfLayer?.content_signals_ok === true, "Content-Signal mismatch") ||
    failed;

  const originLayer = assessOriginLayer(layers);
  failed =
    !check("CF7", originLayer.path_hygiene_ok === false, "origin should lack path hygiene") ||
    failed;
  failed =
    !check("CF8", originLayer.sitemap_present === false, "origin should lack sitemap") ||
    failed;

  const md = assessMaxDiscovery(layers.effective.groups, "example.com", {
    layers,
    deployment_model: "cloudflare_managed"
  });
  const trainingViolations = md.violations.filter((v) =>
    ["MD_GPTBot", "MD_Google_Extended", "MD_CCBot"].includes(v.id)
  );
  failed =
    !check(
      "CF9",
      trainingViolations.length === 0,
      `CF-credited training violations: ${trainingViolations.map((v) => v.id).join(", ")}`
    ) || failed;

  const originViolations = md.violations.filter((v) => v.layer === "origin");
  failed =
    !check(
      "CF10",
      originViolations.length >= 3,
      `expected origin path violations, got ${originViolations.length}`
    ) || failed;
  failed =
    !check("CF11", md.compliant === false, "fixture should not be fully compliant") ||
    failed;

  const full = assessRobotsTxtContent(cfFixture, "max_discovery", "example.com");
  failed =
    !check(
      "CF12",
      full.deployment_model === "cloudflare_managed",
      `deployment_model=${full.deployment_model}`
    ) || failed;
  failed =
    !check(
      "CF13",
      full.assessment.deployment?.model === "cloudflare_managed",
      "handoff deployment.model missing"
    ) || failed;
  failed =
    !check(
      "CF14",
      full.assessment.layer_assessment?.cloudflare?.training_bots_blocked === true,
      "layer_assessment.cloudflare missing"
    ) || failed;
  failed =
    !check(
      "CF15",
      Array.isArray(full.assessment.recommendations_split?.origin_file) &&
        full.assessment.recommendations_split.origin_file.length >= 1,
      "recommendations_split.origin_file empty"
    ) || failed;

  failed =
    !check("CF16", detectCloudflareManaged(goodFixture) === false, "false positive on good fixture") ||
    failed;

  const good = assessRobotsTxtContent(goodFixture, "max_discovery", "example.com");
  failed =
    !check(
      "CF17",
      good.deployment_model === "origin_only",
      "good fixture should be origin_only"
    ) || failed;
  failed =
    !check(
      "CF18",
      good.assessment.layer_assessment === null,
      "origin_only should not populate layer_assessment"
    ) || failed;

  const append = buildCloudflareOriginAppend("example.com", {
    crawl_policy: "max_discovery"
  });
  failed =
    !check("CF19", append.includes("ai-input=yes"), "origin append missing ai-input=yes") ||
    failed;
  failed =
    !check("CF20", append.includes("User-agent: OAI-SearchBot"), "missing OAI-SearchBot group") ||
    failed;
  failed =
    !check("CF21", append.includes("Sitemap: https://example.com/sitemap.xml"), "missing sitemap") ||
    failed;
  failed =
    !check(
      "CF22",
      contentSignalsPresetForCrawlPolicy("max_discovery") === "search_and_ai_input",
      "preset mapping"
    ) || failed;

  const fullTemplate = assessRobotsTxtContent(cfFixture, "max_discovery", "example.com");
  failed =
    !check(
      "CF23",
      fullTemplate.assessment.origin_append_template?.includes("Content-Signal:") === true,
      "assessment missing origin_append_template"
    ) || failed;
  failed =
    !check(
      "CF24",
      fullTemplate.assessment.content_signals?.preset === "search_and_ai_input",
      "content_signals metadata missing"
    ) || failed;

  console.log("");
  if (failed) {
    console.error("One or more Cloudflare layer checks failed.");
    process.exit(1);
  }

  console.log("All CF1–CF24 passed.");
}

main();
