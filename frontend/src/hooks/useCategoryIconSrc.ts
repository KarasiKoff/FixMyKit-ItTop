import { useEffect, useState } from 'react';
import sadCatUrl from '../icon/sad-cat.svg';
import { fetchCategoryIconBlob } from '../api/categories';

/**
 * URL для <img>: заглушка sad-cat или blob с иконкой категории (с Bearer).
 */
export function useCategoryIconSrc(categoryId: string | null | undefined, hasIcon: boolean): string {
    const [src, setSrc] = useState<string>(sadCatUrl);

    useEffect(() => {
        if (!categoryId || !hasIcon) {
            setSrc(sadCatUrl);
            return;
        }
        let cancelled = false;
        let blobUrl: string | null = null;
        void fetchCategoryIconBlob(categoryId)
            .then((blob) => {
                if (cancelled) return;
                if (blob && blob.size > 0) {
                    blobUrl = URL.createObjectURL(blob);
                    setSrc(blobUrl);
                } else {
                    setSrc(sadCatUrl);
                }
            })
            .catch(() => {
                if (!cancelled) setSrc(sadCatUrl);
            });
        return () => {
            cancelled = true;
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [categoryId, hasIcon]);

    return src;
}

export { sadCatUrl as categoryFallbackIconUrl };
