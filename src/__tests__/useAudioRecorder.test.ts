import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";

// Mock useMp3Encoder
const mockEncode = vi.fn();
vi.mock("../hooks/useMp3Encoder", () => ({
  useMp3Encoder: () => ({ encode: mockEncode, isEncoding: false }),
}));

// Mock useMp4Muxer
const mockMux = vi.fn();
const mockCancel = vi.fn();
vi.mock("../hooks/useMp4Muxer", () => ({
  useMp4Muxer: () => ({ mux: mockMux, cancel: mockCancel, isMuxing: false }),
}));

// Mock mergeAudioStreams
const mockMergedAudioTrack = { kind: "audio", stop: vi.fn() };
const mockMergedStream = {
  id: "merged",
  getTracks: vi.fn(() => [mockMergedAudioTrack]),
  getAudioTracks: vi.fn(() => [mockMergedAudioTrack]),
  getVideoTracks: vi.fn(() => []),
} as unknown as MediaStream;
const mockAudioContext = {
  close: vi.fn().mockResolvedValue(undefined),
  state: "running",
} as unknown as AudioContext;

vi.mock("../utils/audio-helpers", () => ({
  mergeAudioStreams: vi.fn(() => ({
    mergedStream: mockMergedStream,
    audioContext: mockAudioContext,
  })),
}));

// --- Browser API mocks ---

interface MockMediaRecorderInstance {
  state: string;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  onerror: ((e: { error: Error }) => void) | null;
}

let mockMediaRecorder: MockMediaRecorderInstance;
let mockSystemAudioTrack: { stop: ReturnType<typeof vi.fn>; kind: string };
let mockVideoTrack: { stop: ReturnType<typeof vi.fn>; kind: string };
let mockMicTrack: { stop: ReturnType<typeof vi.fn>; kind: string };

function createMockDisplayStream(includeAudio: boolean) {
  const tracks = [mockVideoTrack];
  const audioTracks = includeAudio ? [mockSystemAudioTrack] : [];
  return {
    getTracks: vi.fn(() => [...tracks, ...audioTracks]),
    getAudioTracks: vi.fn(() => audioTracks),
    getVideoTracks: vi.fn(() => [mockVideoTrack]),
  };
}

function createMockMicStream() {
  return {
    getTracks: vi.fn(() => [mockMicTrack]),
    getAudioTracks: vi.fn(() => [mockMicTrack]),
    getVideoTracks: vi.fn(() => []),
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();

  mockSystemAudioTrack = { stop: vi.fn(), kind: "audio" };
  mockVideoTrack = { stop: vi.fn(), kind: "video" };
  mockMicTrack = { stop: vi.fn(), kind: "audio" };

  mockMediaRecorder = {
    state: "inactive",
    start: vi.fn(() => {
      mockMediaRecorder.state = "recording";
    }),
    stop: vi.fn(() => {
      mockMediaRecorder.state = "inactive";
    }),
    pause: vi.fn(() => {
      mockMediaRecorder.state = "paused";
    }),
    resume: vi.fn(() => {
      mockMediaRecorder.state = "recording";
    }),
    ondataavailable: null,
    onstop: null,
    onerror: null,
  };

  const MockMediaRecorderClass = vi.fn(() => mockMediaRecorder);
  (MockMediaRecorderClass as unknown as { isTypeSupported: ReturnType<typeof vi.fn> }).isTypeSupported = vi.fn(() => true);

  vi.stubGlobal("MediaRecorder", MockMediaRecorderClass);

  // Mock MediaStream constructor for screen mode (jsdom doesn't have it)
  vi.stubGlobal("MediaStream", vi.fn(() => {
    const tracks: Array<{ kind: string; stop: ReturnType<typeof vi.fn> }> = [];
    return {
      addTrack: vi.fn((track: { kind: string; stop: ReturnType<typeof vi.fn> }) => {
        tracks.push(track);
      }),
      getTracks: vi.fn(() => [...tracks]),
      getAudioTracks: vi.fn(() => tracks.filter((t) => t.kind === "audio")),
      getVideoTracks: vi.fn(() => tracks.filter((t) => t.kind === "video")),
    };
  }));

  const displayStream = createMockDisplayStream(true);
  const micStream = createMockMicStream();

  vi.stubGlobal("navigator", {
    mediaDevices: {
      getDisplayMedia: vi.fn().mockResolvedValue(displayStream),
      getUserMedia: vi.fn().mockResolvedValue(micStream),
    },
  });

  mockEncode.mockResolvedValue(new Blob(["mp3"], { type: "audio/mpeg" }));
  mockMux.mockResolvedValue(new Blob(["mp4"], { type: "video/mp4" }));

  // Mock Blob.arrayBuffer since jsdom support can be unreliable
  const originalArrayBuffer = Blob.prototype.arrayBuffer;
  Blob.prototype.arrayBuffer = function () {
    return originalArrayBuffer
      ? originalArrayBuffer.call(this)
      : Promise.resolve(new ArrayBuffer(8));
  };

  // Mock AudioContext for decodeAudioData
  vi.stubGlobal("AudioContext", vi.fn(() => ({
    decodeAudioData: vi.fn().mockResolvedValue({
      numberOfChannels: 1,
      sampleRate: 44100,
      length: 44100,
      duration: 1,
      getChannelData: () => new Float32Array(44100),
    }),
    close: vi.fn().mockResolvedValue(undefined),
    state: "running",
  })));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useAudioRecorder", () => {
  test("initial state is idle with no error and no blob", () => {
    const { result } = renderHook(() => useAudioRecorder());

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.audioBlob).toBeNull();
    expect(result.current.duration).toBe(0);
  });

  test("start transitions to recording status", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("recording");
    expect(result.current.error).toBeNull();
  });

  test("start calls getDisplayMedia and getUserMedia", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(navigator.mediaDevices.getDisplayMedia).toHaveBeenCalledWith({
      video: true,
      audio: true,
    });
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: true,
    });
  });

  test("start stops video track immediately", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(mockVideoTrack.stop).toHaveBeenCalled();
  });

  test("start creates MediaRecorder with correct mime type", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(MediaRecorder).toHaveBeenCalledWith(mockMergedStream, {
      mimeType: "audio/webm;codecs=opus",
    });
  });

  test("sets error when permission is denied", async () => {
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValueOnce(
      new DOMException("Permission denied", "NotAllowedError"),
    );

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBeTruthy();
  });

  test("sets error when no system audio track is shared", async () => {
    const noAudioStream = createMockDisplayStream(false);
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValueOnce(
      noAudioStream as unknown as MediaStream,
    );

    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(
      "System audio not shared. Please enable 'Share audio' when sharing your screen.",
    );
  });

  test("pause transitions to paused status", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      result.current.pause();
    });

    expect(result.current.status).toBe("paused");
    expect(mockMediaRecorder.pause).toHaveBeenCalled();
  });

  test("resume transitions back to recording status", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      result.current.pause();
    });

    act(() => {
      result.current.resume();
    });

    expect(result.current.status).toBe("recording");
    expect(mockMediaRecorder.resume).toHaveBeenCalled();
  });

  test("duration increments while recording", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.duration).toBe(0);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.duration).toBe(3);
  });

  test("duration pauses when recording is paused", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.duration).toBe(2);

    act(() => {
      result.current.pause();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.duration).toBe(2);
  });

  test("duration resumes after pause", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    act(() => {
      result.current.pause();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    act(() => {
      result.current.resume();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.duration).toBe(3);
  });

  test("stop triggers encoding and produces audioBlob", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      result.current.stop();
      // Simulate MediaRecorder producing data and stopping
      mockMediaRecorder.ondataavailable?.({
        data: new Blob(["audio-data"], { type: "audio/webm" }),
      });
      mockMediaRecorder.onstop?.();
    });

    // Wait for encoding promise to resolve
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe("stopped");
    expect(result.current.audioBlob).toBeInstanceOf(Blob);
  });

  test("happy path: start -> record -> pause -> resume -> stop", async () => {
    const { result } = renderHook(() => useAudioRecorder());

    // Start
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("recording");

    // Record for 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.duration).toBe(2);

    // Pause
    act(() => {
      result.current.pause();
    });
    expect(result.current.status).toBe("paused");

    // Time passes while paused
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.duration).toBe(2);

    // Resume
    act(() => {
      result.current.resume();
    });
    expect(result.current.status).toBe("recording");

    // Record 1 more second
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.duration).toBe(3);

    // Stop
    await act(async () => {
      result.current.stop();
      mockMediaRecorder.ondataavailable?.({
        data: new Blob(["audio-data"], { type: "audio/webm" }),
      });
      mockMediaRecorder.onstop?.();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe("stopped");
    expect(result.current.audioBlob).toBeInstanceOf(Blob);
  });

  test("cleanup on unmount stops all tracks and closes AudioContext", async () => {
    const { result, unmount } = renderHook(() => useAudioRecorder());

    await act(async () => {
      await result.current.start();
    });

    unmount();

    expect(mockSystemAudioTrack.stop).toHaveBeenCalled();
    expect(mockMicTrack.stop).toHaveBeenCalled();
  });

  test("initial state includes videoBlob as null and mode", () => {
    const { result } = renderHook(() => useAudioRecorder());

    expect(result.current.videoBlob).toBeNull();
    expect(result.current.mode).toBe("audio");
  });

  test("mode defaults to audio when not specified", () => {
    const { result } = renderHook(() => useAudioRecorder());
    expect(result.current.mode).toBe("audio");
  });
});

describe("useAudioRecorder - screen mode", () => {
  test("mode is screen when passed as parameter", () => {
    const { result } = renderHook(() => useAudioRecorder("screen"));
    expect(result.current.mode).toBe("screen");
  });

  test("screen mode does NOT stop video tracks after getDisplayMedia", async () => {
    const { result } = renderHook(() => useAudioRecorder("screen"));

    await act(async () => {
      await result.current.start();
    });

    expect(mockVideoTrack.stop).not.toHaveBeenCalled();
  });

  test("screen mode creates MediaRecorder with video+audio mimeType", async () => {
    const { result } = renderHook(() => useAudioRecorder("screen"));

    await act(async () => {
      await result.current.start();
    });

    expect(MediaRecorder).toHaveBeenCalledWith(
      expect.anything(),
      { mimeType: "video/webm;codecs=vp8,opus" },
    );
  });

  test("screen mode MediaRecorder receives stream with video track", async () => {
    const { result } = renderHook(() => useAudioRecorder("screen"));

    await act(async () => {
      await result.current.start();
    });

    // The first argument to MediaRecorder should be a MediaStream
    // that includes video tracks (not just merged audio)
    const constructorCall = vi.mocked(MediaRecorder).mock.calls[0];
    const stream = constructorCall[0] as unknown as MediaStream;
    // In screen mode the stream passed should NOT be the mockMergedStream
    // (which is audio-only), it should be a new combined stream
    expect(stream).not.toBe(mockMergedStream);
  });

  test("screen mode on stop passes blob to MP4 muxer, not MP3 encoder", async () => {
    const { result } = renderHook(() => useAudioRecorder("screen"));

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      result.current.stop();
      mockMediaRecorder.ondataavailable?.({
        data: new Blob(["video-data"], { type: "video/webm" }),
      });
      mockMediaRecorder.onstop?.();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockMux).toHaveBeenCalledWith(expect.any(Blob));
    expect(mockEncode).not.toHaveBeenCalled();
  });

  test("screen mode sets videoBlob after successful mux", async () => {
    const { result } = renderHook(() => useAudioRecorder("screen"));

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      result.current.stop();
      mockMediaRecorder.ondataavailable?.({
        data: new Blob(["video-data"], { type: "video/webm" }),
      });
      mockMediaRecorder.onstop?.();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe("stopped");
    expect(result.current.videoBlob).toBeInstanceOf(Blob);
    expect(result.current.audioBlob).toBeNull();
  });

  test("screen mode sets error on mux failure", async () => {
    mockMux.mockRejectedValueOnce(new Error("Muxing failed"));

    const { result } = renderHook(() => useAudioRecorder("screen"));

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      result.current.stop();
      mockMediaRecorder.ondataavailable?.({
        data: new Blob(["video-data"], { type: "video/webm" }),
      });
      mockMediaRecorder.onstop?.();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Muxing failed");
  });

  test("screen mode sets error when permission is denied", async () => {
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockRejectedValueOnce(
      new DOMException("Permission denied", "NotAllowedError"),
    );

    const { result } = renderHook(() => useAudioRecorder("screen"));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBeTruthy();
  });

  test("screen mode sets error when no audio tracks are shared", async () => {
    const noAudioStream = createMockDisplayStream(false);
    vi.mocked(navigator.mediaDevices.getDisplayMedia).mockResolvedValueOnce(
      noAudioStream as unknown as MediaStream,
    );

    const { result } = renderHook(() => useAudioRecorder("screen"));

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe(
      "System audio not shared. Please enable 'Share audio' when sharing your screen.",
    );
  });

  test("screen mode pause/resume works", async () => {
    const { result } = renderHook(() => useAudioRecorder("screen"));

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("recording");

    act(() => {
      result.current.pause();
    });
    expect(result.current.status).toBe("paused");
    expect(mockMediaRecorder.pause).toHaveBeenCalled();

    act(() => {
      result.current.resume();
    });
    expect(result.current.status).toBe("recording");
    expect(mockMediaRecorder.resume).toHaveBeenCalled();
  });

  test("screen mode cleanup stops video tracks", async () => {
    const { result, unmount } = renderHook(() => useAudioRecorder("screen"));

    await act(async () => {
      await result.current.start();
    });

    // In screen mode, video track should NOT have been stopped during start
    expect(mockVideoTrack.stop).not.toHaveBeenCalled();

    unmount();

    // After cleanup, video track should be stopped
    expect(mockVideoTrack.stop).toHaveBeenCalled();
    expect(mockSystemAudioTrack.stop).toHaveBeenCalled();
    expect(mockMicTrack.stop).toHaveBeenCalled();
  });

  test("screen mode happy path: start -> record -> pause -> resume -> stop", async () => {
    const { result } = renderHook(() => useAudioRecorder("screen"));

    // Start
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.status).toBe("recording");

    // Record for 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.duration).toBe(2);

    // Pause
    act(() => {
      result.current.pause();
    });
    expect(result.current.status).toBe("paused");

    // Time passes while paused
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.duration).toBe(2);

    // Resume
    act(() => {
      result.current.resume();
    });
    expect(result.current.status).toBe("recording");

    // Record 1 more second
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.duration).toBe(3);

    // Stop
    await act(async () => {
      result.current.stop();
      mockMediaRecorder.ondataavailable?.({
        data: new Blob(["video-data"], { type: "video/webm" }),
      });
      mockMediaRecorder.onstop?.();
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe("stopped");
    expect(result.current.videoBlob).toBeInstanceOf(Blob);
    expect(result.current.audioBlob).toBeNull();
  });
});
