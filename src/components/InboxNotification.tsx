import { useState } from 'react';

interface InboxItem {
  filename: string;
  text: string;
  format: string;
}

export function InboxNotification({
  items,
  onDismiss,
  onSummarize,
}: {
  items: InboxItem[];
  onDismiss: (i: number) => void;
  onSummarize: (item: InboxItem) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (items.length === 0) return null;

  return (
    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">
          📂 Inbox: {items.length} file{items.length !== 1 ? 's' : ''} detected
        </h3>
      </div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded p-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-700 dark:text-gray-300 truncate">{item.filename}</span>
              <span className="text-xs text-gray-500 uppercase ml-2">{item.format}</span>
            </div>
            {expanded === i && (
              <p className="text-xs text-gray-500 mt-1 line-clamp-3">{item.text.slice(0, 300)}</p>
            )}
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => setExpanded(expanded === i ? null : i)}
                className="text-xs text-blue-500 hover:underline"
              >
                {expanded === i ? 'Hide' : 'Preview'}
              </button>
              <button
                onClick={() => onSummarize(item)}
                className="text-xs text-purple-500 hover:underline"
              >
                Summarize
              </button>
              <button
                onClick={() => onDismiss(i)}
                className="text-xs text-red-500 hover:underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
