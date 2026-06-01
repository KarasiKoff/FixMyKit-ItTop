import { useEffect, useRef } from 'react';
import { buildRepairRequestsSseUrl, type RepairRequestSsePayload } from '../api/sse';

export function useRepairRequestSse(options: {
    repairRequestId?: string;
    enabled?: boolean;
    onEvent: (payload: RepairRequestSsePayload) => void;
}) {
    const onEventRef = useRef(options.onEvent);
    onEventRef.current = options.onEvent;

    const enabled = options.enabled !== false;
    const repairRequestId = options.repairRequestId;

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }
        const url = buildRepairRequestsSseUrl(
            repairRequestId ? { repairRequestId } : undefined,
        );
        if (!url) {
            return undefined;
        }

        const es = new EventSource(url);

        const onRepairRequest = (event: MessageEvent<string>) => {
            try {
                const data = JSON.parse(event.data) as RepairRequestSsePayload;
                onEventRef.current(data);
            } catch {
                
            }
        };

        es.addEventListener('repair_request', onRepairRequest);

        return () => {
            es.removeEventListener('repair_request', onRepairRequest);
            es.close();
        };
    }, [enabled, repairRequestId]);
}
