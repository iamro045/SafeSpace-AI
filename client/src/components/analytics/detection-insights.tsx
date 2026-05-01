interface DetectionInsight {
  type: string;
  count: number;
  percentage: number;
}

interface DetectionInsightsProps {
  insights: DetectionInsight[];
  languageDistribution: Record<string, number>;
}

export default function DetectionInsights({ insights, languageDistribution }: DetectionInsightsProps) {
  const widthClassFromPercent = (pct: number) => {
    const safePct = Math.max(0, Math.min(100, pct));
    const rounded = Math.round(safePct / 5) * 5;
    return `w-[${rounded}%]`;
  };

  const getViolationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      hate_speech: 'Hate Speech',
      inappropriate: 'Inappropriate Images',
      spam: 'Spam',
      nudity: 'Nudity/Adult Content',
      violence: 'Violence',
      repetitive: 'Repetitive Content',
    };
    return labels[type] || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getViolationTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      hate_speech: 'bg-red-500',
      inappropriate: 'bg-orange-500',
      spam: 'bg-blue-500',
      nudity: 'bg-purple-500',
      violence: 'bg-red-700',
      repetitive: 'bg-yellow-500',
    };
    return colors[type] || 'bg-gray-500';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">AI Detection Insights</h3>
      </div>
      <div className="p-4">
        <div className="space-y-5">
          {/* Content Type Distribution */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Content Types Flagged Today</h4>
            <div className="space-y-4">
              {insights.slice(0, 3).map((insight, index) => (
                <div key={insight.type}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${getViolationTypeColor(insight.type)}`}></div>
                      <span className="text-sm text-gray-600">
                        {getViolationTypeLabel(insight.type)}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {insight.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`${getViolationTypeColor(insight.type)} h-2 rounded-full ${widthClassFromPercent(insight.percentage)}`}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Language Distribution */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Language Detection</h4>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(languageDistribution).map(([lang, percentage]) => {
                const languageLabels: Record<string, string> = {
                  en: 'English',
                  hi: 'Hindi',
                  ta: 'Tamil',
                  other: 'Other',
                };
                
                return (
                  <div key={lang} className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-900">{percentage}%</p>
                    <p className="text-xs text-gray-600">{languageLabels[lang] || lang}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
