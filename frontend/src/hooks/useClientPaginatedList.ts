import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PageSize } from '../types/listQuery';
import { filtersEqual } from '../utils/filtersMatch';

/** Пагинация по уже загруженному массиву (без offset на API). */
export function useClientPaginatedList<TItem, TFilters extends Record<string, unknown>>({
    emptyFilters,
    defaultPageSize = 20,
    fetchAll,
    onError,
}: {
    emptyFilters: TFilters;
    defaultPageSize?: PageSize;
    fetchAll: (filters: TFilters) => Promise<TItem[]>;
    onError?: (message: string) => void;
}) {
    const [allItems, setAllItems] = useState<TItem[]>([]);
    const [fetching, setFetching] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<PageSize>(defaultPageSize);
    const [draftFilters, setDraftFilters] = useState<TFilters>(emptyFilters);
    const [appliedFilters, setAppliedFilters] = useState<TFilters>(emptyFilters);

    const fetchAllRef = useRef(fetchAll);
    const onErrorRef = useRef(onError);
    fetchAllRef.current = fetchAll;
    onErrorRef.current = onError;

    const reload = useCallback(
        async (opts?: { silent?: boolean; resetPage?: boolean }) => {
            if (!opts?.silent) {
                setFetching(true);
            }
            try {
                const items = await fetchAllRef.current(appliedFilters);
                setAllItems(items);
                if (opts?.resetPage !== false) {
                    setPage(1);
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : 'Ошибка загрузки';
                onErrorRef.current?.(message);
            } finally {
                if (!opts?.silent) {
                    setFetching(false);
                }
            }
        },
        [appliedFilters],
    );

    useEffect(() => {
        void reload();
    }, [reload]);

    const applyFilters = useCallback(() => {
        setAppliedFilters({ ...draftFilters });
        setPage(1);
    }, [draftFilters]);

    const total = allItems.length;
    const items = useMemo(() => {
        const start = (page - 1) * pageSize;
        return allItems.slice(start, start + pageSize);
    }, [allItems, page, pageSize]);

    const filtersPending = !filtersEqual(draftFilters, appliedFilters);

    return {
        items,
        total,
        fetching,
        page,
        pageSize,
        draftFilters,
        setDraftFilters,
        appliedFilters,
        applyFilters,
        filtersPending,
        setPage,
        setPageSize,
        reload,
    };
}
