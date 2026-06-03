import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fetchAudiences, type AudienceDto } from '../api/audiences';
import { FilterCombobox } from '../components/FilterCombobox';
import { RoomMapView } from '../components/RoomMapView';
export function RoomMapsPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const audienceLookupRef = useRef<Map<string, string>>(new Map());
    const [roomQuery, setRoomQuery] = useState('');
    const [selectedAudience, setSelectedAudience] = useState<AudienceDto | null>(null);
    const [initializing, setInitializing] = useState(true);

    const syncAudienceToUrl = useCallback(
        (audience: AudienceDto | null) => {
            if (audience) {
                setSearchParams({ audience: String(audience.id) }, { replace: true });
            } else {
                setSearchParams({}, { replace: true });
            }
        },
        [setSearchParams],
    );

    const selectAudience = useCallback(
        (audience: AudienceDto | null) => {
            setSelectedAudience(audience);
            if (audience) {
                setRoomQuery(audience.name);
            }
            syncAudienceToUrl(audience);
        },
        [syncAudienceToUrl],
    );

    useEffect(() => {
        let cancelled = false;
        const raw = searchParams.get('audience')?.trim();

        if (!raw) {
            setInitializing(false);
            return;
        }

        fetchAudiences()
            .then((items) => {
                if (cancelled) return;
                const found = items.find((a) => a.id === raw);
                if (found) {
                    audienceLookupRef.current.set(found.name, found.id);
                    setRoomQuery(found.name);
                    setSelectedAudience(found);
                }
            })
            .catch(() => {
                /* URL с неверным id — оставляем пустой выбор */
            })
            .finally(() => {
                if (!cancelled) setInitializing(false);
            });

        return () => {
            cancelled = true;
        };
    }, [searchParams]);

    const suggestRooms = useCallback(async (query: string) => {
        const items = await fetchAudiences(query);
        const map = audienceLookupRef.current;
        for (const a of items) {
            map.set(a.name, a.id);
        }
        return items.map((a) => a.name);
    }, []);

    function handleRoomQueryChange(name: string) {
        setRoomQuery(name);
        const id = audienceLookupRef.current.get(name);
        if (id != null) {
            selectAudience({ id, name });
            return;
        }
        selectAudience(null);
    }

    return (
        <main className="page page--wide room-maps-page">
            <h2 className="page-title room-maps-page__title">Карта кабинетов</h2>

            <section className="card room-maps-page__toolbar">
                <div className="room-maps-page__search">
                    <FilterCombobox
                        label="Кабинет"
                        value={roomQuery}
                        placeholder="Поиск по названию…"
                        fetchSuggestions={suggestRooms}
                        onChange={handleRoomQueryChange}
                    />
                </div>
            </section>

            <section className="card room-maps-page__map-card">
                {initializing ? (
                    <p className="muted-text">Загрузка…</p>
                ) : !selectedAudience ? (
                    <p className="muted-text room-maps-page__hint">Выберите кабинет в поле поиска выше.</p>
                ) : (
                    <>
                        <p className="room-maps-page__audience-name">
                            Кабинет <strong>{selectedAudience.name}</strong>
                        </p>
                        <RoomMapView
                            audienceId={selectedAudience.id}
                            emptyMessage="Карта не настроена"
                            onDeviceClick={(deviceId) => navigate(`/devices/${deviceId}`)}
                        />
                    </>
                )}
            </section>
        </main>
    );
}
