export const SkeletonTable = ({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) => {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Table header skeleton */}
      <div className="grid gap-4 p-4 bg-gray-100 border-b border-gray-200" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={`header-${i}`} className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
        ))}
      </div>

      {/* Table rows skeleton */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={`row-${rowIdx}`}
          className="grid gap-4 p-4 border-b border-gray-200 last:border-b-0 hover:bg-gray-50 transition-colors"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div
              key={`cell-${rowIdx}-${colIdx}`}
              className="h-4 bg-gray-200 rounded animate-pulse"
              style={{ width: `${Math.random() * 40 + 60}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export default SkeletonTable;
