export interface AIDetectionResult {
  isViolation: boolean;
  confidence: number;
  violationType: string[];
  explanation: string;
  detectedLanguage?: string;
}

export interface ImageAnalysisResult extends AIDetectionResult {
  faces?: number;
  objects?: string[];
}

export class AIService {
  // Text analysis using rule-based approach and basic NLP
  async analyzeText(content: string, language: string = "en"): Promise<AIDetectionResult> {
    const result: AIDetectionResult = {
      isViolation: false,
      confidence: 0,
      violationType: [],
      explanation: "",
      detectedLanguage: language,
    };

    // Hate speech detection patterns
    const hateSpeechPatterns = {
      en: [
        /\b(hate|kill|murder|die)\s+(you|him|her|them)\b/i,
        /\b(stupid|idiot|moron|retard)\b/i,
        /\bfuck\s+(you|off|this)\b/i,
        /\b(racist|bigot|nazi)\b/i,
      ],
      hi: [
        /\b(मार|मरना|हत्या)\b/i,
        /\b(गधा|मूर्ख|बेवकूफ)\b/i,
        /\b(भाड़\s*में\s*जा)\b/i,
      ],
    };

    // Spam detection patterns
    const spamPatterns = [
      /\b(buy now|click here|limited time|act fast)\b/i,
      /\b(free money|easy money|get rich)\b/i,
      /\b(viagra|casino|lottery|winner)\b/i,
      /(.)\1{4,}/, // Repeated characters
    ];

    // Inappropriate content patterns
    const inappropriatePatterns = [
      /\b(sex|nude|naked|porn)\b/i,
      /\b(drugs|cocaine|marijuana|weed)\b/i,
      /\b(violence|fight|beating)\b/i,
    ];

    let maxConfidence = 0;
    const violations: string[] = [];

    // Check hate speech
    const patterns = hateSpeechPatterns[language as keyof typeof hateSpeechPatterns] || hateSpeechPatterns.en;
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        violations.push("hate_speech");
        maxConfidence = Math.max(maxConfidence, 0.9);
        break;
      }
    }

    // Check spam
    for (const pattern of spamPatterns) {
      if (pattern.test(content)) {
        violations.push("spam");
        maxConfidence = Math.max(maxConfidence, 0.8);
        break;
      }
    }

    // Check inappropriate content
    for (const pattern of inappropriatePatterns) {
      if (pattern.test(content)) {
        violations.push("inappropriate");
        maxConfidence = Math.max(maxConfidence, 0.85);
        break;
      }
    }

    // Check for excessive caps (shouting)
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.7 && content.length > 10) {
      violations.push("excessive_caps");
      maxConfidence = Math.max(maxConfidence, 0.6);
    }

    // Check for repeated words/phrases
    const words = content.toLowerCase().split(/\s+/);
    const wordCounts = words.reduce((acc, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const hasRepeatedWords = Object.values(wordCounts).some(count => count > 3);
    if (hasRepeatedWords) {
      violations.push("repetitive");
      maxConfidence = Math.max(maxConfidence, 0.7);
    }

    result.isViolation = violations.length > 0;
    result.confidence = maxConfidence;
    result.violationType = violations;
    result.explanation = this.generateExplanation(violations, language);

    return result;
  }

  // Image analysis using basic content detection
  async analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
    // Simulate AI image analysis
    // In a real implementation, this would use computer vision models
    const result: ImageAnalysisResult = {
      isViolation: false,
      confidence: 0,
      violationType: [],
      explanation: "",
      faces: 0,
      objects: [],
    };

    // Simulate detection based on filename/url patterns
    const filename = imageUrl.toLowerCase();
    
    // Check for potentially inappropriate content based on filename
    if (filename.includes('nude') || filename.includes('nsfw') || filename.includes('adult')) {
      result.isViolation = true;
      result.confidence = 0.95;
      result.violationType = ['nudity'];
      result.explanation = "Detected potential nudity or adult content";
    } else if (filename.includes('violence') || filename.includes('weapon') || filename.includes('blood')) {
      result.isViolation = true;
      result.confidence = 0.88;
      result.violationType = ['violence'];
      result.explanation = "Detected potential violent content";
    } else {
      // Random simulation for demo purposes
      const random = Math.random();
      if (random < 0.1) { // 10% chance of flagging
        result.isViolation = true;
        result.confidence = 0.75 + Math.random() * 0.2;
        result.violationType = ['inappropriate'];
        result.explanation = "Image content analysis detected potential policy violation";
      }
    }

    // Simulate face detection
    result.faces = Math.floor(Math.random() * 3);
    
    // Simulate object detection
    const commonObjects = ['person', 'car', 'building', 'tree', 'food', 'animal'];
    result.objects = commonObjects.slice(0, Math.floor(Math.random() * 4));

    return result;
  }

  // Generate human-readable explanation for moderation decisions
  private generateExplanation(violations: string[], language: string): string {
    if (violations.length === 0) return "Content appears to be appropriate";

    const explanations = {
      hate_speech: language === "hi" 
        ? "घृणास्पद भाषा या हानिकारक शब्दावली का पता चला"
        : "Detected hate speech or harmful language",
      spam: language === "hi"
        ? "स्पैम या अवांछित प्रचार सामग्री का पता चला"
        : "Detected spam or unwanted promotional content",
      inappropriate: language === "hi"
        ? "अनुचित या आपत्तिजनक सामग्री का पता चला"
        : "Detected inappropriate or objectionable content",
      excessive_caps: language === "hi"
        ? "अत्यधिक बड़े अक्षर (चिल्लाना) का पता चला"
        : "Detected excessive use of capital letters (shouting)",
      repetitive: language === "hi"
        ? "दोहराव वाली या स्पैम सामग्री का पता चला"
        : "Detected repetitive or spam-like content",
      nudity: "Detected potential nudity or adult content",
      violence: "Detected potential violent content",
    };

    const reasons = violations.map(v => explanations[v as keyof typeof explanations]).filter(Boolean);
    return reasons.join("; ");
  }

  // Check AI model health
  async checkModelHealth(modelName: string): Promise<{ status: string; message?: string }> {
    // Simulate model health checks
    const models = ['Text Analysis', 'Image Detection', 'Video Analysis'];
    
    if (!models.includes(modelName)) {
      return { status: 'error', message: 'Model not found' };
    }

    // Simulate random health status
    const random = Math.random();
    if (random < 0.9) {
      return { status: 'active' };
    } else if (random < 0.95) {
      return { status: 'loading', message: 'Model is initializing' };
    } else {
      return { status: 'error', message: 'Model temporarily unavailable' };
    }
  }
}

export const aiService = new AIService();
