import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchDeviceById } from '../api/devices';
import { fetchRepairRequest } from '../api/repairRequests';
import type { Device } from '../types/device';
import type { RepairRequestDetail } from '../types/repairRequest';
import { useToast } from './useToast';
import { formatApiError } from '../utils/formatApiError';
import { splitResolutionNoteFromApi } from '../utils/resolutionNoteTracker';
import { fetchUserListItemById } from '../api/users';
import { useRepairRequestSse } from './useRepairRequestSse';

export function useRepairRequestDetail(requestId: string | undefined) {
    const { showError } = useToast();
    const [request, setRequest] = useState<RepairRequestDetail | null>(null);
    const [device, setDevice] = useState<Device | null>(null);
    const [loading, setLoading] = useState(true);
    const [closedByDbLabel, setClosedByDbLabel] = useState<string | null>(null);
    const [commentsRefreshKey, setCommentsRefreshKey] = useState(0);

    const applyRequestUpdate = useCallback(async (updated: RepairRequestDetail) => {
        setRequest(updated);
        if (updated.deviceId) {
            setDevice(await fetchDeviceById(updated.deviceId));
        } else {
            setDevice(null);
        }
    }, []);

    const reload = useCallback(
        async (opts?: { silent?: boolean }) => {
            if (!requestId) {
                return;
            }
            if (!opts?.silent) {
                setLoading(true);
            }
            try {
                const req = await fetchRepairRequest(requestId);
                setRequest(req);
                if (req.deviceId) {
                    setDevice(await fetchDeviceById(req.deviceId));
                } else {
                    setDevice(null);
                }
            } catch (err) {
                if (!opts?.silent) {
                    setRequest(null);
                    setDevice(null);
                    showError(formatApiError(err));
                }
            } finally {
                if (!opts?.silent) {
                    setLoading(false);
                }
            }
        },
        [requestId, showError],
    );

    useEffect(() => {
        void reload();
    }, [reload]);

    useRepairRequestSse({
        repairRequestId: requestId,
        enabled: Boolean(requestId),
        onEvent: (payload) => {
            if (payload.repair_request_id === requestId) {
                setCommentsRefreshKey((k) => k + 1);
                void reload({ silent: true });
            }
        },
    });

    const noteParts = useMemo(() => {
        if (!request) {
            return { resolutionTrimmed: '', closedFromMeta: '' };
        }
        const { resolutionBody, trackerClosedBy } = splitResolutionNoteFromApi(request.resolutionNote);
        const resolutionTrimmed = resolutionBody.trim();
        const closedFromMeta =
            request.status === 'closed' ? request.closedByTrackerDisplay?.trim() || trackerClosedBy || '' : '';
        return { resolutionTrimmed, closedFromMeta };
    }, [request]);

    useEffect(() => {
        let cancelled = false;
        async function resolveClosedByName() {
            if (!request || request.status !== 'closed') {
                setClosedByDbLabel(null);
                return;
            }
            if (noteParts.closedFromMeta) {
                setClosedByDbLabel(null);
                return;
            }
            const uid = request.closedByUserId?.trim();
            if (!uid) {
                setClosedByDbLabel(null);
                return;
            }
            try {
                const u = await fetchUserListItemById(uid);
                if (!cancelled) {
                    setClosedByDbLabel(u ? u.name || u.login : null);
                }
            } catch {
                if (!cancelled) {
                    setClosedByDbLabel(null);
                }
            }
        }
        void resolveClosedByName();
        return () => {
            cancelled = true;
        };
    }, [request, noteParts.closedFromMeta]);

    return {
        request,
        device,
        loading,
        closedByDbLabel,
        commentsRefreshKey,
        noteParts,
        reload,
        applyRequestUpdate,
        bumpComments: () => setCommentsRefreshKey((k) => k + 1),
    };
}
