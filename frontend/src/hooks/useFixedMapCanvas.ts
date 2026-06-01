import { useMemo, type CSSProperties } from 'react';
import { mapCanvasGridPx } from '../utils/mapChipConstants';

/** Фиксированные width/height холста под сетку (без масштабирования и без probe). */
export function useFixedMapCanvas(gridCols: number, gridRows: number) {
    const { width, height } = useMemo(
        () => mapCanvasGridPx(gridCols, gridRows),
        [gridCols, gridRows],
    );

    const canvasStyle: CSSProperties = {
        width: `${width}px`,
        height: `${height}px`,
        minWidth: `${width}px`,
        minHeight: `${height}px`,
        maxWidth: 'none',
        flexShrink: 0,
    };

    const wrapStyle: CSSProperties = {
        minHeight: `${height}px`,
    };

    return { canvasStyle, wrapStyle, canvasWidth: width, canvasHeight: height };
}
