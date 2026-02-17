import { useState } from "react";

export default function PermissionGuide() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <ol className="space-y-1 text-sm text-zinc-400">
          <li>1. Click Record</li>
          <li>2. Choose a screen/tab</li>
          <li>3. Enable &quot;Share audio&quot;</li>
          <li>4. Click Share</li>
        </ol>
        <button
          onClick={() => setVisible(false)}
          className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-300"
          aria-label="Dismiss"
        >
          &#x2715;
        </button>
      </div>
    </div>
  );
}
