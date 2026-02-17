import { useAudioRecorder } from "./hooks/useAudioRecorder";
import StatusIndicator from "./components/StatusIndicator";
import RecordingControls from "./components/RecordingControls";
import AudioPreview from "./components/AudioPreview";
import PermissionGuide from "./components/PermissionGuide";

function App() {
  const { start, stop, pause, resume, status, error, audioBlob, duration } =
    useAudioRecorder();

  return (
    <div className="flex min-h-screen flex-col bg-[#09090b] px-4 py-6 sm:px-8">
      {/* Header */}
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-zinc-100">
          PC Audio Recorder
        </h1>
        <StatusIndicator status={status} error={error} />
      </header>

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
          />
        </div>

        {/* Right panel: Audio Preview */}
        <div className="flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/50 p-8">
          <AudioPreview audioBlob={audioBlob} />
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
