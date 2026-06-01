import type { CSSProperties, ReactNode, RefObject } from 'react';
import { mapCanvasGridPx } from '../utils/mapChipConstants';
import { MapDoorPlaque, type MapDoorEdge } from './MapDoorPlaque';

type Props = {
    doorEdge: MapDoorEdge;
    gridCols: number;
    gridRows: number;
    canvasStyle: CSSProperties;
    wrapStyle?: CSSProperties;
    canvasRef?: RefObject<HTMLDivElement>;
    canvasClassName?: string;
    canvasProps?: React.HTMLAttributes<HTMLDivElement>;
    children: ReactNode;
};

export function MapCanvasStack({
    doorEdge,
    gridCols,
    gridRows,
    canvasStyle,
    wrapStyle,
    canvasRef,
    canvasClassName = 'map-canvas map-canvas--map-light map-canvas--editor-fill map-canvas--fixed-grid',
    canvasProps,
    children,
}: Props) {
    const { width } = mapCanvasGridPx(gridCols, gridRows);
    const stackStyle: CSSProperties = { width: `${width}px` };

    return (
        <div className="map-canvas-stack" style={stackStyle}>
            {doorEdge === 'top' && <MapDoorPlaque edge="top" />}
            <div className="map-canvas-wrap map-canvas-wrap--scroll" style={wrapStyle}>
                <div className={canvasClassName} style={canvasStyle} {...canvasProps}>
                    <div className="map-canvas-inner" ref={canvasRef}>
                        {children}
                    </div>
                </div>
            </div>
            {doorEdge === 'bottom' && <MapDoorPlaque edge="bottom" />}
        </div>
    );
}
