#!/usr/bin/env node
/**
 * Golden tests for domain-agnostic query intent classification.
 *
 * Usage:
 *   node scripts/verify-intent-classifier.mjs
 */
import {
  brandTermsFromDomain,
  classifyQueryIntent
} from "./classify-query-intent.mjs";

const cases = [
  {
    id: "I1",
    domain: "example.com",
    query: "example pricing",
    expect: "brand"
  },
  {
    id: "I2",
    domain: "example.com",
    query: "wordpress support plan",
    expect: "commercial"
  },
  {
    id: "I3",
    domain: "example.com",
    query: "wordpress support jobs",
    expect: "job"
  },
  {
    id: "I4",
    domain: "example.com",
    query: "how to configure ga4 snippet",
    expect: "diy"
  },
  {
    id: "I5",
    domain: "example.com",
    query: "wordpress analytics plugin",
    expect: "product"
  },
  {
    id: "I6",
    domain: "acme.io",
    query: "managed wordpress maintenance",
    expect: "commercial"
  },
  {
    id: "I7",
    domain: "acme.io",
    query: "site:acme.io pricing",
    expect: "brand"
  }
];

function main() {
  let failed = 0;
  for (const c of cases) {
    const brandTerms = brandTermsFromDomain(c.domain);
    const got = classifyQueryIntent(c.query, brandTerms);
    if (got === c.expect) {
      console.log(`PASS ${c.id}`);
    } else {
      failed++;
      console.error(`FAIL ${c.id}: expected ${c.expect}, got ${got} (${c.query})`);
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
