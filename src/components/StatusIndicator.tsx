import type { RecordingStatus } from "../hooks/useAudioRecorder";

interface StatusIndicatorProps {
  status: RecordingStatus;
  error: string | null;
}

const statusConfig: Record<
  RecordingStatus,
  { color: string; label: string; animate?: string }
> = {
  idle: { color: "bg-zinc-500", label: "Ready" },
  requesting: { color: "bg-cyan-500", label: "Requesting..." },
  recording: { color: "bg-red-500", label: "Recording", animate: "animate-pulse" },
  paused: { color: "bg-amber-500", label: "Paused" },
  stopped: { color: "bg-zinc-500", label: "Stopped" },
  encoding: { color: "bg-cyan-500", label: "Encoding...", animate: "animate-spin" },
  error: { color: "bg-red-500", label: "Error" },
};

export default function StatusIndicator({ status, error }: StatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${config.color} ${config.animate ?? ""}`}
      />
      <span className="text-sm text-zinc-300">
        {status === "error" && error ? error : config.label}
      </span>
    </div>
  );
}
