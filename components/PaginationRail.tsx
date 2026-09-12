interface PaginationRailProps {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  onPageChange: (page: number) => void;
}

export default function PaginationRail({ currentPage, totalPages, totalResults, onPageChange }: PaginationRailProps) {
  const firstResult = (currentPage - 1) * 12 + 1;
  const lastResult = Math.min(currentPage * 12, totalResults);

  return (
    <nav aria-label="Ticket pages" className="mt-8 border-t border-line pt-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="shrink-0 text-[9px] font-bold tracking-[0.14em] text-muted uppercase">
          {firstResult}–{lastResult} of {totalResults} artists
        </p>
        <div className="-mx-1 flex min-w-0 max-w-full snap-x snap-mandatory gap-1.5 overflow-x-auto px-1 pb-1 no-scrollbar" aria-label="Choose ticket page">
          {Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            const isCurrent = page === currentPage;
            return (
              <button
                key={page}
                type="button"
                aria-label={`Page ${page}`}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => onPageChange(page)}
                className={`inline-flex size-9 shrink-0 snap-start items-center justify-center rounded-full border text-[10px] font-black tracking-[0.08em] transition-colors ${isCurrent ? 'border-accent-red bg-accent-red text-white' : 'border-line bg-white text-ink hover:border-ink'}`}
              >
                {page}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
