import { useCallback, useEffect, useRef, useState } from 'react';
import type { PageSize, SortDir } from '../types/listQuery';
import { filtersEqual } from '../utils/filtersMatch';

type ListResult<TItem> = {
    items: TItem[];
    total: number;
};

type UsePaginatedListOptions<TItem, TFilters, TSortBy extends string> = {
    emptyFilters: TFilters;
    defaultSort: TSortBy;
    defaultDir?: SortDir;
    defaultPageSize?: PageSize;
    load: (params: {
        filters: TFilters;
        page: number;
        pageSize: PageSize;
        sortBy: TSortBy;
        sortDir: SortDir;
    }) => Promise<ListResult<TItem>>;
    onError?: (message: string) => void;
};

export function usePaginatedList<TItem, TFilters extends Record<string, unknown>, TSortBy extends string>({
    emptyFilters,
    defaultSort,
    defaultDir = 'asc',
    defaultPageSize = 20,
    load,
    onError,
}: UsePaginatedListOptions<TItem, TFilters, TSortBy>) {
    const [items, setItems] = useState<TItem[]>([]);
    const [total, setTotal] = useState(0);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<PageSize>(defaultPageSize);
    const [sortBy, setSortBy] = useState<TSortBy>(defaultSort);
    const [sortDir, setSortDir] = useState<SortDir>(defaultDir);
    const [draftFilters, setDraftFilters] = useState<TFilters>(emptyFilters);
    const [appliedFilters, setAppliedFilters] = useState<TFilters>(emptyFilters);

    const loadRef = useRef(load);
    const onErrorRef = useRef(onError);
    loadRef.current = load;
    onErrorRef.current = onError;

    const applyFilters = useCallback(() => {
        setAppliedFilters({ ...draftFilters });
        setPage(1);
    }, [draftFilters]);

    const reload = useCallback(
        async (opts?: { silent?: boolean }) => {
            if (!opts?.silent) {
                setFetching(true);
                setError(null);
            }
            try {
                const result = await loadRef.current({
                    filters: appliedFilters,
                    page,
                    pageSize,
                    sortBy,
                    sortDir,
                });
                setItems(result.items);
                setTotal(result.total);
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Ошибка загрузки';
                if (!opts?.silent) {
                    setError(message);
                }
                onErrorRef.current?.(message);
            } finally {
                if (!opts?.silent) {
                    setFetching(false);
                }
            }
        },
        [appliedFilters, page, pageSize, sortBy, sortDir],
    );

    useEffect(() => {
        void reload();
    }, [reload]);

    const filtersPending = !filtersEqual(draftFilters, appliedFilters);

    function handleSort(key: string) {
        const col = key as TSortBy;
        setPage(1);
        if (sortBy === col) {
            setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortBy(col);
            setSortDir('asc');
        }
    }

    return {
        items,
        total,
        fetching,
        error,
        page,
        pageSize,
        sortBy,
        sortDir,
        draftFilters,
        setDraftFilters,
        appliedFilters,
        applyFilters,
        filtersPending,
        setPage,
        setPageSize,
        setSortDir,
        handleSort,
        reload,
    };
}
