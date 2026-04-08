import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`animate-pulse bg-gray-700 rounded ${className}`}></div>
  );
};

export const TableSkeleton: React.FC<{ rows?: number, cols?: number }> = ({ rows = 5, cols = 4 }) => {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-700 bg-gray-800">
      <div className="flex border-b border-gray-700 bg-gray-750 p-4 gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`th-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={`tr-${rowIndex}`} className="flex border-b border-gray-700 p-4 gap-4">
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={`td-${rowIndex}-${colIndex}`} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md min-h-[120px] flex flex-col justify-between">
      <Skeleton className="h-4 w-1/2 mb-4" />
      <div>
        <Skeleton className="h-8 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="flex justify-end mt-4">
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
};
