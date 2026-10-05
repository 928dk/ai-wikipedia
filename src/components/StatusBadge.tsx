export function StatusBadge({ status, score }: { status: string; score: number }) {
  const configs = {
    verified: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', icon: '✓' },
    disputed: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200', icon: '?' },
    unverified: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-200', icon: '−' },
  };
  const config = configs[status as keyof typeof configs] || configs.unverified;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.icon} {status} {score > 0 && `(${Math.round(score * 100)}%)`}
    </span>
  );
}
