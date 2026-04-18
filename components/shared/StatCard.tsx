
import React from 'react';

interface StatCardProps { 
  title: string; 
  subtitle: string; 
  value: string; 
  percentage: string; 
  variation: number; 
}

const StatCard: React.FC<StatCardProps> = ({ title, subtitle, value, percentage, variation }) => {
  const isPositive = (Number(variation) || 0) >= 0;
  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md min-h-[120px] flex flex-col justify-between">
      <p className="text-sm font-medium text-gray-400 truncate" title={title}>{title}</p>
      <div className="mt-2">
        <h3 className="text-2xl font-bold text-white truncate">{value}</h3>
        <p className="text-sm text-gray-400 truncate">{percentage}</p>
      </div>
      <div className={`text-xs font-semibold text-right mt-2 ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
        {isPositive ? '▲' : '▼'} {Math.abs(Number(variation) || 0).toFixed(2)}%
        <span className="text-gray-500 ml-1 font-normal">{subtitle}</span>
      </div>
    </div>
  );
};

export default StatCard;
