import type { AttachmentDraft } from '../components/AttachmentUploader';

export function draftsToFiles(drafts: AttachmentDraft[]): File[] {
    return drafts.map((d) => d.file);
}
