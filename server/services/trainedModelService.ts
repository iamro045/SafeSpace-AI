import { modelTrainingService } from "./modelTrainingService";
import { predict, type TrainedTextModel } from "./textModel";

class TrainedModelService {
  private cachedModel: TrainedTextModel | null = null;
  private lastLoadedAt = 0;

  // Cache for a short period to avoid disk reads on every request
  private readonly cacheMs = 5_000;

  async getTextModel(): Promise<TrainedTextModel | null> {
    const now = Date.now();
    if (this.cachedModel && now - this.lastLoadedAt < this.cacheMs) {
      return this.cachedModel;
    }

    const model = await modelTrainingService.loadLatestTextModel();
    this.cachedModel = model;
    this.lastLoadedAt = now;
    return model;
  }

  async predictText(text: string): Promise<ReturnType<typeof predict> | null> {
    const model = await this.getTextModel();
    if (!model) return null;
    return predict(model, text);
  }

  clearCache() {
    this.cachedModel = null;
    this.lastLoadedAt = 0;
  }
}

export const trainedModelService = new TrainedModelService();
