export const SkeletonCard = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`rounded-lg border border-gray-200 p-4 ${className}`}>
      <div className="space-y-4">
        {/* Header skeleton */}
        <div className="h-6 bg-gray-200 rounded animate-pulse w-3/4" />
        
        {/* Content skeleton */}
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse w-full" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6" />
          <div className="h-4 bg-gray-200 rounded animate-pulse w-4/6" />
        </div>

        {/* Footer skeleton */}
        <div className="flex gap-2 pt-2">
          <div className="h-8 bg-gray-200 rounded animate-pulse w-20" />
          <div className="h-8 bg-gray-200 rounded animate-pulse w-24" />
        </div>
      </div>
    </div>
  );
};

export default SkeletonCard;
