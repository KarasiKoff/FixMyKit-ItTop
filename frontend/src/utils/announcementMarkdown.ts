function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function applyInlineMarkdown(text: string): string {
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(
        /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    );
    return html;
}

export function renderAnnouncementMarkdownHtml(source: string): string {
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    const blocks = lines.map((line) => {
        if (!line.trim()) {
            return '<br />';
        }
        return `<span>${applyInlineMarkdown(line)}</span>`;
    });
    return blocks.join('<br />');
}
