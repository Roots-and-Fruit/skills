/**
 * Heuristic hub-type hints from URL path (overridable in handoff review).
 */

export const HUB_TYPES = ["commercial", "technical", "trust", "product", "unknown"];

const RULES = [
  {
    type: "commercial",
    test: (path) =>
      /^\/(pricing|plans|contact|demo|buy|checkout|quote|services|solutions|platform)(\/|$)/.test(
        path
      )
  },
  {
    type: "product",
    test: (path) =>
      /^\/(product|products|shop|store|app)(\/|$)/.test(path) ||
      /\/product\//.test(path)
  },
  {
    type: "trust",
    test: (path) =>
      /^\/(about|team|careers|customers|case-studies|testimonials|security|privacy|legal|trust|hiring|jobs)(\/|$)/.test(
        path
      ) ||
      /certified|b-corp|bcorp/.test(path)
  },
  {
    type: "technical",
    test: (path) =>
      /^\/(blog|articles|posts|news|docs|documentation|help|support|guides|resources|learn|kb)(\/|$)/.test(
        path
      ) ||
      /\/\d{4}\//.test(path)
  }
];

export function classifyHubType(url) {
  let path = "/";
  try {
    path = new URL(url).pathname.toLowerCase();
  } catch {
    return "unknown";
  }

  for (const rule of RULES) {
    if (rule.test(path)) {
      return rule.type;
    }
  }

  // Shallow paths often commercial LPs: /features/analytics
  const segments = path.split("/").filter(Boolean);
  if (segments.length === 1) {
    return "commercial";
  }
  if (segments.length === 2 && ["features", "integrations", "use-cases"].includes(segments[0])) {
    return "commercial";
  }

  return "unknown";
}
