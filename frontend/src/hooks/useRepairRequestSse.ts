import { useEffect, useRef } from 'react';
import { buildRepairRequestsSseUrl, fetchSseTicket, type RepairRequestSsePayload } from '../api/sse';

const RECONNECT_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

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

        let es: EventSource | null = null;
        let cancelled = false;

        const onRepairRequest = (event: MessageEvent<string>) => {
            try {
                const data = JSON.parse(event.data) as RepairRequestSsePayload;
                onEventRef.current(data);
            } catch {
                /* malformed SSE payload */
            }
        };

        const connect = async () => {
            while (!cancelled) {
                try {
                    const ticket = await fetchSseTicket();
                    if (cancelled) {
                        return;
                    }
                    const url = buildRepairRequestsSseUrl(ticket.sse_token, repairRequestId ? { repairRequestId } : undefined);
                    es?.close();
                    es = new EventSource(url);
                    es.addEventListener('repair_request', onRepairRequest);

                    await new Promise<void>((resolve) => {
                        if (!es) {
                            resolve();
                            return;
                        }
                        const handleError = () => {
                            es?.removeEventListener('error', handleError);
                            resolve();
                        };
                        es.addEventListener('error', handleError);
                    });
                } catch {
                    /* ticket or stream failed */
                }

                if (cancelled) {
                    return;
                }
                await sleep(RECONNECT_DELAY_MS);
            }
        };

        void connect();

        return () => {
            cancelled = true;
            if (es) {
                es.removeEventListener('repair_request', onRepairRequest);
                es.close();
            }
        };
    }, [enabled, repairRequestId]);
}
