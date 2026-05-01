import { aiService } from "../services/aiService";

type Case = {
  name: string;
  text: string;
  expectViolation: boolean;
  expectLabel?: string;
};

const cases: Case[] = [
  { name: "baseline clean", text: "hello world", expectViolation: false },

  // Strong terms (should be blocked)
  { name: "strong profanity uppercase", text: "HARAMI", expectViolation: true, expectLabel: "abusive_language" },
  { name: "strong profanity spaced", text: "c h u t i y a", expectViolation: true, expectLabel: "abusive_language" },
  { name: "strong profanity punctuated", text: "c.h.u.t.i.y.a", expectViolation: true, expectLabel: "abusive_language" },
  { name: "strong profanity repeated chars", text: "chuuuuutiyyaa", expectViolation: true, expectLabel: "abusive_language" },

  // Mild terms (should be at least flagged)
  { name: "mild insult", text: "pagal", expectViolation: true, expectLabel: "harassment" },
  { name: "mild insult punctuated", text: "p.a.g.a.l", expectViolation: true, expectLabel: "harassment" },
];

async function main() {
  let failed = 0;

  for (const c of cases) {
    const r = await aiService.analyzeText(c.text, "hi");

    const okViolation = r.isViolation === c.expectViolation;
    const okLabel = c.expectLabel ? r.classificationLabel === c.expectLabel : true;

    if (!okViolation || !okLabel) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error(
        `[FAIL] ${c.name}: expected violation=${c.expectViolation}` +
          (c.expectLabel ? ` label=${c.expectLabel}` : "") +
          `, got violation=${r.isViolation} label=${r.classificationLabel} conf=${r.confidence.toFixed(2)} sev=${r.severityScore.toFixed(2)} terms=[${r.contributingTerms.join(", ")}]`
      );
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `[OK]   ${c.name}: violation=${r.isViolation} label=${r.classificationLabel} conf=${r.confidence.toFixed(2)} sev=${r.severityScore.toFixed(2)}`
      );
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
