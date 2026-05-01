import fs from "fs";
import path from "path";

export type AbuseLexicon = {
  blockTerms: string[];
  reviewTerms: string[];
  updatedAt: string;
};

const DEFAULT_LEXICON: AbuseLexicon = {
  blockTerms: ["fuck", "fucking", "fukin", "chutiya", "chutiye", "harami"],
  reviewTerms: ["pagal", "murkh"],
  updatedAt: new Date().toISOString(),
};

function normalizeTerm(t: string): string {
  return String(t || "")
    .trim()
    .toLowerCase()
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ");
}

function uniqNonEmpty(terms: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of terms || []) {
    const t = normalizeTerm(raw);
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

class AbuseLexiconService {
  private readonly lexiconPath: string;
  private cache: { lexicon: AbuseLexicon; loadedAtMs: number } | null = null;
  private readonly cacheMs = 2_000;

  constructor() {
    // Store in project-local file so it works without DB migrations.
    this.lexiconPath = path.resolve(process.cwd(), "server", "data", "abuse-lexicon.json");
  }

  private ensureDirExists() {
    const dir = path.dirname(this.lexiconPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  private coerceLexicon(input: any): AbuseLexicon {
    const blockTerms = uniqNonEmpty(Array.isArray(input?.blockTerms) ? input.blockTerms : []);
    const reviewTerms = uniqNonEmpty(Array.isArray(input?.reviewTerms) ? input.reviewTerms : []);
    const updatedAt = typeof input?.updatedAt === "string" && input.updatedAt ? input.updatedAt : new Date().toISOString();

    return { blockTerms, reviewTerms, updatedAt };
  }

  async getLexicon(): Promise<AbuseLexicon> {
    const now = Date.now();
    if (this.cache && now - this.cache.loadedAtMs < this.cacheMs) return this.cache.lexicon;

    this.ensureDirExists();
    if (!fs.existsSync(this.lexiconPath)) {
      await fs.promises.writeFile(this.lexiconPath, JSON.stringify(DEFAULT_LEXICON, null, 2), "utf-8");
      this.cache = { lexicon: DEFAULT_LEXICON, loadedAtMs: now };
      return DEFAULT_LEXICON;
    }

    try {
      const raw = await fs.promises.readFile(this.lexiconPath, "utf-8");
      const parsed = JSON.parse(raw);
      const lexicon = this.coerceLexicon(parsed);
      this.cache = { lexicon, loadedAtMs: now };
      return lexicon;
    } catch {
      this.cache = { lexicon: DEFAULT_LEXICON, loadedAtMs: now };
      return DEFAULT_LEXICON;
    }
  }

  async updateLexicon(next: { blockTerms: string[]; reviewTerms: string[] }): Promise<AbuseLexicon> {
    this.ensureDirExists();
    const updated: AbuseLexicon = {
      blockTerms: uniqNonEmpty(next.blockTerms || []),
      reviewTerms: uniqNonEmpty(next.reviewTerms || []),
      updatedAt: new Date().toISOString(),
    };

    // Persist lexicon exactly as provided.
    await fs.promises.writeFile(this.lexiconPath, JSON.stringify(updated, null, 2), "utf-8");
    this.cache = { lexicon: this.coerceLexicon(updated), loadedAtMs: Date.now() };
    return this.cache.lexicon;
  }
}

export const abuseLexiconService = new AbuseLexiconService();
