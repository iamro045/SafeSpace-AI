export type TextLabel =
  | "clean"
  | "hate_speech"
  | "abusive_language"
  | "threats"
  | "harassment"
  | "sexual_content"
  | "spam";

export type TrainedTextModel = {
  modelName: "Text Analysis";
  version: string;
  trainedAt: string;
  languages: string[];
  labels: TextLabel[];

  // Naive Bayes counts
  docCountByLabel: Record<TextLabel, number>;
  tokenCountByLabel: Record<TextLabel, number>;
  tokenCounts: Record<TextLabel, Record<string, number>>;
  vocabularySize: number;

  labelSeverity: Record<TextLabel, number>; // 0..1
};

export type TextPrediction = {
  label: TextLabel;
  confidence: number;
  severityScore: number;
  topTerms: string[];
};

const DEFAULT_LABEL_SEVERITY: Record<TextLabel, number> = {
  clean: 0,
  spam: 0.35,
  abusive_language: 0.55,
  harassment: 0.65,
  sexual_content: 0.75,
  hate_speech: 0.85,
  threats: 0.9,
};

function decodeHtmlEntities(input: string): string {
  // Minimal entity decoding for common tweet dataset encodings.
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      if (!Number.isFinite(code)) return " ";
      try {
        return String.fromCodePoint(code);
      } catch {
        return " ";
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(String(hex), 16);
      if (!Number.isFinite(code)) return " ";
      try {
        return String.fromCodePoint(code);
      } catch {
        return " ";
      }
    });
}

export function tokenize(text: string): string[] {
  // Split on non letters/digits; include Devanagari block for Hindi.
  // Also normalize tweet-like artifacts (URLs/mentions/hashtags) into stable tokens.
  const normalized = decodeHtmlEntities(String(text))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " URLHERE ")
    .replace(/\bwww\.[^\s]+/g, " URLHERE ")
    .replace(/@[\w_]+/g, " MENTIONHERE ")
    .replace(/#[\w_]+/g, " HASHTAGHERE ")
    .replace(/\s+/g, " ")
    .trim();

  const STOP_WORDS = new Set([
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "for",
    "if", "in", "into", "is", "it", "no", "not", "of", "on", "or",
    "such", "that", "the", "their", "then", "there", "these", "they",
    "this", "to", "was", "will", "with", "you", "your", "yours"
  ]);

  return normalized
    .replace(/[^A-Za-z0-9\u0900-\u097F\s]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t))
    .slice(0, 200);
}

function softmax(scores: Record<string, number>): Record<string, number> {
  const vals = Object.values(scores);
  const max = Math.max(...vals);
  const exps = Object.fromEntries(
    Object.entries(scores).map(([k, v]) => [k, Math.exp(v - max)])
  ) as Record<string, number>;
  const sum = Object.values(exps).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(exps).map(([k, v]) => [k, v / sum]));
}

export function predict(model: TrainedTextModel, text: string): TextPrediction {
  const tokens = tokenize(text);
  const totalDocs = model.labels.reduce((acc, l) => acc + (model.docCountByLabel[l] || 0), 0) || 1;

  const logScores: Record<TextLabel, number> = {} as any;

  for (const label of model.labels) {
    // Use equal priors instead of empirical priors to avoid skewed predictions from imbalanced datasets
    const logPrior = Math.log(1 / model.labels.length);

    let score = logPrior;
    const tokenCounts = model.tokenCounts[label] || {};
    const denom = (model.tokenCountByLabel[label] || 0) + model.vocabularySize;

    for (const token of tokens) {
      const count = tokenCounts[token] || 0;
      const prob = (count + 1) / denom; // Laplace
      score += Math.log(prob);
    }

    logScores[label] = score;
  }

  const probs = softmax(logScores as any);
  const sorted = Object.entries(probs).sort((a, b) => b[1] - a[1]);
  const [bestLabel, bestProb] = sorted[0] as [TextLabel, number];

  // contributing terms: likelihood ratio best vs clean
  const cleanCounts = model.tokenCounts.clean || {};
  const bestCounts = model.tokenCounts[bestLabel] || {};
  const cleanDenom = (model.tokenCountByLabel.clean || 0) + model.vocabularySize;
  const bestDenom = (model.tokenCountByLabel[bestLabel] || 0) + model.vocabularySize;

  const termScores = tokens.map((t) => {
    const pBest = ((bestCounts[t] || 0) + 1) / bestDenom;
    const pClean = ((cleanCounts[t] || 0) + 1) / cleanDenom;
    return { t, s: Math.log(pBest / pClean) };
  });

  const topTerms = termScores
    .sort((a, b) => b.s - a.s)
    .map((x) => x.t)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, 5);

  const baseSeverity = model.labelSeverity[bestLabel] ?? DEFAULT_LABEL_SEVERITY[bestLabel] ?? 0.5;
  const severityScore = Math.min(1, baseSeverity * (0.6 + 0.4 * bestProb));

  return {
    label: bestLabel,
    confidence: bestProb,
    severityScore,
    topTerms,
  };
}

export function createEmptyModel(version: string): TrainedTextModel {
  const labels: TextLabel[] = [
    "clean",
    "hate_speech",
    "abusive_language",
    "threats",
    "harassment",
    "sexual_content",
    "spam",
  ];

  return {
    modelName: "Text Analysis",
    version,
    trainedAt: new Date().toISOString(),
    languages: ["en", "hi"],
    labels,
    docCountByLabel: Object.fromEntries(labels.map((l) => [l, 0])) as any,
    tokenCountByLabel: Object.fromEntries(labels.map((l) => [l, 0])) as any,
    tokenCounts: Object.fromEntries(labels.map((l) => [l, {}])) as any,
    vocabularySize: 0,
    labelSeverity: { ...DEFAULT_LABEL_SEVERITY },
  };
}
