import { useState } from "react";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import type { RecordingMode } from "./hooks/useAudioRecorder";
import StatusIndicator from "./components/StatusIndicator";
import RecordingControls from "./components/RecordingControls";
import AudioPreview from "./components/AudioPreview";
import VideoPreview from "./components/VideoPreview";
import PermissionGuide from "./components/PermissionGuide";

function App() {
  const [mode, setMode] = useState<RecordingMode>("audio");
  const { start, stop, pause, resume, status, error, audioBlob, videoBlob, duration } =
    useAudioRecorder(mode);

  const isToggleDisabled =
    status === "recording" || status === "paused" || status === "encoding";

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] px-4 py-6 sm:px-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-100">
          PC Audio Recorder
        </h1>
        <StatusIndicator status={status} error={error} />
      </header>

      {/* Mode toggle */}
      <div className="mt-4 flex justify-center gap-4" role="radiogroup" aria-label="Recording mode">
        <label
          className={`cursor-pointer rounded-lg border px-4 py-2 text-sm transition-colors ${
            mode === "audio"
              ? "border-cyan-500 bg-cyan-500/20 text-cyan-400"
              : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
          } ${isToggleDisabled ? "pointer-events-none opacity-50" : ""}`}
        >
          <input
            type="radio"
            name="mode"
            value="audio"
            checked={mode === "audio"}
            onChange={() => setMode("audio")}
            disabled={isToggleDisabled}
            className="sr-only"
            aria-label="Audio"
          />
          Audio
        </label>
        <label
          className={`cursor-pointer rounded-lg border px-4 py-2 text-sm transition-colors ${
            mode === "screen"
              ? "border-cyan-500 bg-cyan-500/20 text-cyan-400"
              : "border-zinc-700 text-zinc-400 hover:bg-zinc-800"
          } ${isToggleDisabled ? "pointer-events-none opacity-50" : ""}`}
        >
          <input
            type="radio"
            name="mode"
            value="screen"
            checked={mode === "screen"}
            onChange={() => setMode("screen")}
            disabled={isToggleDisabled}
            className="sr-only"
            aria-label="Screen"
          />
          Screen
        </label>
      </div>

      {/* Main content: two-panel layout */}
      <main className="mt-8 grid flex-1 gap-6 md:grid-cols-2">
        {/* Left panel: Recording Controls */}
        <div className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/50 p-8">
          <RecordingControls
            status={status}
            duration={duration}
            onStart={start}
            onStop={stop}
            onPause={pause}
            onResume={resume}
            mode={mode}
          />
        </div>

        {/* Right panel: Preview */}
        <div className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/50 p-8">
          {mode === "screen" ? (
            <VideoPreview videoBlob={videoBlob} />
          ) : (
            <AudioPreview audioBlob={audioBlob} />
          )}
        </div>
      </main>

      {/* Bottom: Permission Guide */}
      <footer className="mt-6">
        <PermissionGuide />
      </footer>
    </div>
  );
}

export default App;
