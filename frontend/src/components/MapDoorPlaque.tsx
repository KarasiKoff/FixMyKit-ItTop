import doorIcon from '../icon/door.svg';

export type MapDoorEdge = 'top' | 'bottom';

type Props = {
    edge: MapDoorEdge;
};

/** Плашка входа: ширина одной клетки, по центру стека холста */
export function MapDoorPlaque(_props: Props) {
    return (
        <div className="map-door-plaque" aria-label="Вход" title="Вход">
            <img src={doorIcon} alt="" className="map-door-plaque__icon" draggable={false} />
            <span className="map-door-plaque__label">Вход</span>
        </div>
    );
}
