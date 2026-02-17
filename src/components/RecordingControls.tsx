import type { RecordingStatus } from "../hooks/useAudioRecorder";
import { formatDuration } from "../utils/audio-helpers";

interface RecordingControlsProps {
  status: RecordingStatus;
  duration: number;
  onStart: () => void;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}

export default function RecordingControls({
  status,
  duration,
  onStart,
  onStop,
  onPause,
  onResume,
}: RecordingControlsProps) {
  const isIdle = status === "idle" || status === "stopped";
  const isRecording = status === "recording";
  const isPaused = status === "paused";
  const isEncoding = status === "encoding";

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Glow effect behind record button */}
      {isIdle && (
        <div className="relative flex items-center justify-center">
          <div className="absolute h-32 w-32 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 opacity-20 blur-2xl" />
          <button
            onClick={onStart}
            className="relative h-20 w-20 rounded-full bg-red-500 text-sm font-bold tracking-wider text-white ring-2 ring-cyan-500 transition-all hover:bg-red-600 hover:ring-cyan-400"
          >
            REC
          </button>
        </div>
      )}

      {isRecording && (
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-32 w-32 animate-pulse rounded-full bg-red-500 opacity-30 blur-2xl" />
            <div className="h-20 w-20 animate-pulse rounded-full bg-red-500" />
          </div>
          <span className="font-mono text-lg text-zinc-100">
            {formatDuration(duration)}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onPause}
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
            >
              Pause
            </button>
            <button
              onClick={onStop}
              className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/30"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {isPaused && (
        <div className="flex flex-col items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-amber-500" />
          <span className="font-mono text-lg text-zinc-100">
            {formatDuration(duration)}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onResume}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm text-white transition-colors hover:bg-cyan-700"
            >
              Resume
            </button>
            <button
              onClick={onStop}
              className="rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-400 transition-colors hover:bg-red-500/30"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {isEncoding && (
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
          <span className="text-sm text-zinc-400">Encoding...</span>
          <button disabled className="rounded-lg px-4 py-2 text-sm text-zinc-600">
            Stop
          </button>
        </div>
      )}
    </div>
  );
}
