interface StatsCardProps {
  title: string;
  value: string | number;
  change: {
    value: string;
    trend: 'up' | 'down';
    color: 'green' | 'red' | 'orange';
  };
  icon: string;
  iconColor: string;
}

export default function StatsCard({ title, value, change, icon, iconColor }: StatsCardProps) {
  const getTrendIcon = (trend: 'up' | 'down') => {
    return trend === 'up' ? 'fas fa-arrow-up' : 'fas fa-arrow-down';
  };

  const getTrendColor = (color: 'green' | 'red' | 'orange') => {
    switch (color) {
      case 'green':
        return 'text-green-600';
      case 'red':
        return 'text-red-600';
      case 'orange':
        return 'text-orange-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200" data-testid="stats-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2" data-testid="stats-value">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          <p className={`text-sm mt-1 ${getTrendColor(change.color)}`}>
            <i className={`${getTrendIcon(change.trend)} text-xs mr-1`}></i>
            {change.value}
          </p>
        </div>
        <div className={`p-3 bg-gray-100 rounded-lg`}>
          <i className={`${icon} ${iconColor} text-lg`}></i>
        </div>
      </div>
    </div>
  );
}
