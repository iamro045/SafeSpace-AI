import fs from "fs";
import path from "path";
import Papa from "papaparse";
import { z } from "zod";
import { createEmptyModel, predict, tokenize, type TextLabel, type TrainedTextModel } from "./textModel";

const AllowedLabels: TextLabel[] = [
  "clean",
  "hate_speech",
  "abusive_language",
  "threats",
  "harassment",
  "sexual_content",
  "spam",
];

const RowSchema = z.object({
  text: z.string().min(1),
  label: z.enum(AllowedLabels as [TextLabel, ...TextLabel[]]),
  language: z.string().optional().nullable(),
});

type IntermediateRow = {
  text: string;
  label: TextLabel | unknown;
  language?: string | null | undefined;
};

export type DatasetMetadata = {
  id: string;
  name: string;
  uploadedAt: string;
  rowCount: number;
  labelCounts: Record<string, number>;
  languages: string[];
  originalFilename: string;
};

export type TrainTextModelResult = {
  modelVersion: string;
  trainedAt: string;
  rowCount: number;
  labelCounts: Record<string, number>;
  vocabularySize: number;
  holdoutAccuracy: number;
  dataset: DatasetMetadata;
};

export type TextModelVersionInfo = {
  version: string;
  fileName: string;
  trainedAt?: string;
  vocabularySize?: number;
};

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function clampLanguage(lang: string | null | undefined): string {
  if (!lang) return "en";
  const normalized = String(lang).trim().toLowerCase();
  if (normalized === "hi" || normalized === "en") return normalized;
  // Common dataset values for code-mixed Hindi-English.
  if (normalized === "hinglish" || normalized === "hi-en" || normalized === "en-hi") return "hi";
  return "en";
}

function cleanText(value: unknown): string {
  if (typeof value !== "string") return "";
  // Remove control chars, normalize whitespace.
  return value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function getFirstColumnValue(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null) return row[k];
  }
  return undefined;
}

function normalizeBinaryYesNoLabel(value: unknown): TextLabel | null {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return null;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;

  if (raw === "yes" || raw === "y" || raw === "true") return "hate_speech";
  if (raw === "no" || raw === "n" || raw === "false") return "clean";

  const n = tryParseNumber(value);
  if (n === 1) return "hate_speech";
  if (n === 0) return "clean";

  return null;
}

function normalizeLabel(value: unknown): TextLabel | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim().toLowerCase();
  if (!raw) return null;

  // Allow native labels (exact)
  if ((AllowedLabels as unknown as string[]).includes(raw)) return raw as TextLabel;

  // Common synonyms
  if (raw === "offensive_language" || raw === "offensive" || raw === "abusive" || raw === "abuse") {
    return "abusive_language";
  }
  if (raw === "neither" || raw === "none" || raw === "neutral" || raw === "clean" || raw === "normal") {
    return "clean";
  }
  if (raw === "hate" || raw === "hate speech" || raw === "hate_speech") {
    return "hate_speech";
  }

  // Numeric labels sometimes appear directly.
  const n = parseInt(raw, 10);
  if (n === 0) return "hate_speech";
  if (n === 1) return "abusive_language";
  if (n === 2) return "clean";

  return null;
}

function looksLikeBinaryYesNoLabelSet(values: string[]): boolean {
  if (!values.length) return false;
  const allowed = new Set(["yes", "no", "y", "n", "true", "false", "0", "1"]);
  return values.every((v) => allowed.has(v));
}

function tryParseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function deriveDavidsonLabel(row: Record<string, unknown>): TextLabel | null {
  // Davidson dataset columns: hate_speech, offensive_language, neither, class (majority)
  // Prefer class if present; else derive majority from vote-count columns.
  const classNum = tryParseNumber(row.class);
  if (classNum !== null) return normalizeLabel(classNum);

  const hate = tryParseNumber(row.hate_speech);
  const off = tryParseNumber(row.offensive_language);
  const nei = tryParseNumber(row.neither);
  if (hate === null || off === null || nei === null) return null;

  const max = Math.max(hate, off, nei);
  const winners = [
    hate === max ? "hate_speech" : null,
    off === max ? "abusive_language" : null,
    nei === max ? "clean" : null,
  ].filter(Boolean) as TextLabel[];

  // If tie, skip row rather than guessing.
  if (winners.length !== 1) return null;
  return winners[0];
}

function chooseMostSevereLabel(labels: TextLabel[]): TextLabel | null {
  if (!labels || labels.length === 0) return null;

  const rank: Record<TextLabel, number> = {
    clean: 0,
    spam: 1,
    harassment: 2,
    abusive_language: 3,
    threats: 4,
    hate_speech: 5,
    sexual_content: 6,
  };

  let best: TextLabel | null = null;
  let bestRank = -1;
  for (const l of labels) {
    const r = rank[l] ?? -1;
    if (r > bestRank) {
      bestRank = r;
      best = l;
    }
  }
  return best;
}

function deriveLabelFromLabelSet(value: unknown): TextLabel | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const tokens = raw
    .split(/[,;|]/g)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) return null;

  const mapped: TextLabel[] = [];
  for (const t of tokens) {
    const normalized = t.replace(/[_\s]+/g, "-");

    if (normalized === "non-hostile" || normalized === "nonhostile" || normalized === "non-hostile-content") {
      mapped.push("clean");
      continue;
    }

    if (normalized === "hate" || normalized === "hatespeech" || normalized === "hate-speech") {
      mapped.push("hate_speech");
      continue;
    }

    if (normalized === "offensive" || normalized === "offensive-language" || normalized === "abusive") {
      mapped.push("abusive_language");
      continue;
    }

    // These datasets often include misinformation-like classes; we map them to the closest operational bucket.
    if (normalized === "fake" || normalized === "spam" || normalized === "misinformation") {
      mapped.push("spam");
      continue;
    }

    if (normalized === "defamation") {
      mapped.push("harassment");
      continue;
    }

    // Allow direct mapping if the token already looks like one of our labels.
    const direct = normalizeLabel(normalized);
    if (direct) mapped.push(direct);
  }

  return chooseMostSevereLabel(mapped);
}

function parseCsv(csvText: string): Array<z.infer<typeof RowSchema>> {
  const parseAndValidate = (opts: { header: boolean }): Array<z.infer<typeof RowSchema>> => {
    const parsed = Papa.parse<Record<string, unknown>>(csvText, {
      header: opts.header,
      skipEmptyLines: true,
    });

    if (parsed.errors?.length) {
      const first = parsed.errors[0];
      throw new Error(`CSV parse error: ${first.message}`);
    }

    const rawRows = (parsed.data || []) as any[];
    if (rawRows.length === 0) return [];

    let rows: IntermediateRow[] = [];

    if (!opts.header) {
      // Headerless files (common in TSV exports): assume first two columns are text + label.
      rows = rawRows
        .map((r: any) => {
          const values = Array.isArray(r) ? r : Object.values(r);
          const text = cleanText(values[0]);
          const labelRaw = values[1];
          const label = normalizeBinaryYesNoLabel(labelRaw) ?? normalizeLabel(labelRaw) ?? (labelRaw as unknown);
          return { text, label, language: null };
        })
        .filter((r) => r.text && r.label);
    } else {
      // Detect schema: native format (text,label,language) vs. common hate-speech dataset (tweet,class,...)
      const sample = rawRows[0] || {};
      const sampleText = getFirstColumnValue(sample, ["text", "Text", "post", "Post", "tweet", "Tweet"]); // broad detection
      const hasTextLikeColumn = typeof sampleText === "string" && String(sampleText).trim().length > 0;
      const hasTweetColumn = typeof sample.tweet === "string" && sample.tweet.trim().length > 0;
      const hasPostColumn = typeof (sample as any).Post === "string" && String((sample as any).Post).trim().length > 0;
      const hasClassColumn = sample.class !== undefined && sample.class !== null && String(sample.class).trim() !== "";
      const hasVoteColumns =
        sample.hate_speech !== undefined || sample.offensive_language !== undefined || sample.neither !== undefined;
      const hasLabelsSetColumn =
        (sample as any)["Labels Set"] !== undefined &&
        (sample as any)["Labels Set"] !== null &&
        String((sample as any)["Labels Set"]).trim() !== "";

      if (hasPostColumn && hasLabelsSetColumn) {
        // Hindi hate-speech dataset variants: Columns: "Post" and "Labels Set".
        rows = rawRows
          .map((r: any) => {
            const text = cleanText(r.Post ?? r.post);
            const label = deriveLabelFromLabelSet(r["Labels Set"] ?? r.labels_set ?? r.label ?? r.labels);
            return { text, label, language: "hi" };
          })
          .filter((r) => r.text && r.label);
      } else if (hasTweetColumn && (hasClassColumn || hasVoteColumns)) {
        // Davidson et al.: tweet + class/votes
        rows = rawRows
          .map((r: any) => {
            const text = cleanText(r.tweet);
            const label = deriveDavidsonLabel(r) ?? normalizeLabel(r.class);
            return { text, label, language: null };
          })
          .filter((r) => r.text && r.label);
      } else if (hasTextLikeColumn) {
        // Generic text datasets (including Hinglish repo processed data with columns text/category)
        const labelValues = rawRows
          .slice(0, 100)
          .map((r: any) =>
            String(
              getFirstColumnValue(r, [
                "label",
                "Label",
                "category",
                "Category",
                "hate_label",
                "hateLabel",
                "Hate_Label",
                "is_hate",
                "isHate",
              ]) ??
                ""
            )
            .trim()
            .toLowerCase())
          .filter(Boolean);
        const unique = Array.from(new Set(labelValues)).slice(0, 10);
        const isBinaryYesNo = looksLikeBinaryYesNoLabelSet(unique);

        rows = rawRows.map((r: any) => {
          const text = cleanText(getFirstColumnValue(r, ["text", "Text", "post", "Post"]) ?? r.text);
          const labelRaw = getFirstColumnValue(r, [
            "label",
            "Label",
            "category",
            "Category",
            "hate_label",
            "hateLabel",
            "Hate_Label",
            "is_hate",
            "isHate",
            "class",
            "Class",
          ]);
          const label =
            (isBinaryYesNo ? normalizeBinaryYesNoLabel(labelRaw) : null) ??
            normalizeLabel(labelRaw) ??
            (labelRaw as TextLabel | unknown);
          const language = getFirstColumnValue(r, ["language", "lang", "Language", "Lang"]) as string | null | undefined;
          return { text, label, language };
        });
      } else {
        // Fallback: attempt native schema mapping; validation below will filter out invalid rows.
        rows = rawRows.map((r: any) => ({
          text: cleanText(r.text),
          label: normalizeLabel(r.label) ?? (r.label as TextLabel | unknown),
          language: r.language as string | null | undefined,
        }));
      }
    }

    const validated: Array<z.infer<typeof RowSchema>> = [];
    for (const row of rows) {
      const normalizedRow = {
        text: cleanText(row.text),
        label: normalizeLabel(row.label) ?? normalizeBinaryYesNoLabel(row.label) ?? row.label,
        language: clampLanguage(row.language),
      };
      const v = RowSchema.safeParse(normalizedRow);
      if (v.success) {
        validated.push(v.data);
      }
    }

    return validated;
  };

  const validated = parseAndValidate({ header: true });
  if (validated.length > 0) return validated;

  // Some datasets (including those produced in the Hinglish repo) are exported as TSV/CSV with no header.
  const validatedHeaderless = parseAndValidate({ header: false });
  if (validatedHeaderless.length > 0) return validatedHeaderless;

  throw new Error(
    "No valid rows found. Expected either: (1) columns text,label,(optional)language with labels in {clean,hate_speech,abusive_language,threats,harassment,sexual_content,spam} or (2) hate-speech dataset format with columns tweet,class where class in {0,1,2} or (3) Hindi hate-speech dataset format with columns Post,Labels Set where Labels Set contains values like hate, offensive, non-hostile, fake, defamation (optionally comma-separated) or (4) a headerless 2-column CSV/TSV where col1=text and col2 is YES/NO or 0/1."
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stratifiedSplit<T extends { label: TextLabel }>(
  rows: T[],
  trainRatio: number
): { trainRows: T[]; testRows: T[] } {
  const byLabel: Record<TextLabel, T[]> = {
    clean: [],
    hate_speech: [],
    abusive_language: [],
    threats: [],
    harassment: [],
    sexual_content: [],
    spam: [],
  };

  for (const r of rows) {
    byLabel[r.label].push(r);
  }

  const trainRows: T[] = [];
  const testRows: T[] = [];

  const labels = Object.keys(byLabel) as TextLabel[];
  for (const label of labels) {
    const group = byLabel[label];
    if (!group || group.length === 0) continue;

    const g = shuffle(group);
    const desiredTrain = Math.floor(g.length * trainRatio);
    // If we have enough samples, keep at least 1 in each split.
    const trainCount = g.length >= 2 ? Math.min(g.length - 1, Math.max(1, desiredTrain)) : g.length;
    trainRows.push(...g.slice(0, trainCount));
    testRows.push(...g.slice(trainCount));
  }

  return { trainRows: shuffle(trainRows), testRows: shuffle(testRows) };
}

export class ModelTrainingService {
  private datasetsDir = path.resolve(process.cwd(), "datasets", "text");
  private modelsDir = path.resolve(process.cwd(), "models", "text");

  async trainTextModelFromCsvFile(params: {
    filePath: string;
    datasetName: string;
    originalFilename: string;
  }): Promise<TrainTextModelResult> {
    ensureDir(this.datasetsDir);
    ensureDir(this.modelsDir);

    const csvText = await fs.promises.readFile(params.filePath, "utf-8");
    const rows = parseCsv(csvText);

    const id = `ds_${Date.now()}`;
    const uploadedAt = new Date().toISOString();

    const labelCounts: Record<string, number> = {};
    const languages = new Set<string>();
    for (const r of rows) {
      labelCounts[r.label] = (labelCounts[r.label] || 0) + 1;
      languages.add(r.language || "en");
    }

    const datasetMeta: DatasetMetadata = {
      id,
      name: params.datasetName,
      uploadedAt,
      rowCount: rows.length,
      labelCounts,
      languages: Array.from(languages.values()).sort(),
      originalFilename: params.originalFilename,
    };

    const version = `1.${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
    const model: TrainedTextModel = createEmptyModel(version);

    const { trainRows, testRows } = stratifiedSplit(rows, 0.8);

    const vocabulary = new Set<string>();

    for (const r of trainRows) {
      model.docCountByLabel[r.label] += 1;
      const tokens = tokenize(r.text);
      for (const t of tokens) {
        vocabulary.add(t);
        model.tokenCounts[r.label][t] = (model.tokenCounts[r.label][t] || 0) + 1;
        model.tokenCountByLabel[r.label] += 1;
      }
    }

    model.vocabularySize = vocabulary.size;

    // Evaluate
    let correct = 0;
    for (const r of testRows) {
      const p = predict(model, r.text);
      if (p.label === r.label) correct += 1;
    }
    const holdoutAccuracy = testRows.length > 0 ? correct / testRows.length : 1;

    const outPath = path.resolve(this.modelsDir, `model-${version}.json`);
    const latestPath = path.resolve(this.modelsDir, "latest.json");

    await fs.promises.writeFile(outPath, JSON.stringify(model, null, 2), "utf-8");
    await fs.promises.writeFile(latestPath, JSON.stringify(model, null, 2), "utf-8");

    // Persist dataset manifest
    const manifestPath = path.resolve(this.datasetsDir, "manifest.json");
    const existing = fs.existsSync(manifestPath)
      ? (JSON.parse(await fs.promises.readFile(manifestPath, "utf-8")) as DatasetMetadata[])
      : ([] as DatasetMetadata[]);
    const updated = [datasetMeta, ...existing].slice(0, 50);
    await fs.promises.writeFile(manifestPath, JSON.stringify(updated, null, 2), "utf-8");

    return {
      modelVersion: version,
      trainedAt: model.trainedAt,
      rowCount: rows.length,
      labelCounts,
      vocabularySize: model.vocabularySize,
      holdoutAccuracy,
      dataset: datasetMeta,
    };
  }

  async listTextDatasets(): Promise<DatasetMetadata[]> {
    const manifestPath = path.resolve(this.datasetsDir, "manifest.json");
    if (!fs.existsSync(manifestPath)) return [];
    const parsed = JSON.parse(await fs.promises.readFile(manifestPath, "utf-8"));
    if (!Array.isArray(parsed)) return [];
    return parsed as DatasetMetadata[];
  }

  async listTextModels(limit: number = 25): Promise<TextModelVersionInfo[]> {
    ensureDir(this.modelsDir);
    const entries = await fs.promises.readdir(this.modelsDir);
    const modelFiles = entries.filter((f) => /^model-1\.[0-9]{14}\.json$/i.test(f));

    // Sort descending by version (timestamp part) which is lexicographically sortable.
    modelFiles.sort((a, b) => b.localeCompare(a));

    const infos: TextModelVersionInfo[] = [];
    for (const fileName of modelFiles.slice(0, Math.max(1, limit))) {
      const match = fileName.match(/^model-(1\.[0-9]{14})\.json$/i);
      const version = match?.[1];
      if (!version) continue;

      try {
        const raw = await fs.promises.readFile(path.resolve(this.modelsDir, fileName), "utf-8");
        const parsed = JSON.parse(raw) as any;
        infos.push({
          version,
          fileName,
          trainedAt: typeof parsed?.trainedAt === "string" ? parsed.trainedAt : undefined,
          vocabularySize: typeof parsed?.vocabularySize === "number" ? parsed.vocabularySize : undefined,
        });
      } catch {
        infos.push({ version, fileName });
      }
    }

    return infos;
  }

  async activateTextModelVersion(version: string): Promise<void> {
    const v = String(version || "").trim();
    if (!/^1\.[0-9]{14}$/.test(v)) {
      throw new Error("Invalid model version format");
    }

    ensureDir(this.modelsDir);
    const sourcePath = path.resolve(this.modelsDir, `model-${v}.json`);
    const latestPath = path.resolve(this.modelsDir, "latest.json");
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Model version not found: ${v}`);
    }

    const raw = await fs.promises.readFile(sourcePath, "utf-8");
    // Validate JSON is parseable before switching.
    JSON.parse(raw);
    await fs.promises.writeFile(latestPath, raw, "utf-8");
  }

  async loadLatestTextModel(): Promise<TrainedTextModel | null> {
    const latestPath = path.resolve(this.modelsDir, "latest.json");
    if (!fs.existsSync(latestPath)) return null;
    try {
      const raw = await fs.promises.readFile(latestPath, "utf-8");
      return JSON.parse(raw) as TrainedTextModel;
    } catch {
      return null;
    }
  }
}

export const modelTrainingService = new ModelTrainingService();
