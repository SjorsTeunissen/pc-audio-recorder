import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMp3Encoder } from "./useMp3Encoder";

class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();

  simulateMessage(data: unknown) {
    this.onmessage?.(new MessageEvent("message", { data }));
  }

  simulateError(message: string) {
    this.onmessage?.(
      new MessageEvent("message", { data: { type: "error", message } }),
    );
  }
}

let mockWorkerInstance: MockWorker;

vi.mock("./useMp3Encoder", async () => {
  const actual =
    await vi.importActual<typeof import("./useMp3Encoder")>("./useMp3Encoder");
  return actual;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockWorkerInstance = new MockWorker();

  vi.stubGlobal(
    "Worker",
    vi.fn(() => mockWorkerInstance),
  );
});

function createMockAudioBuffer(
  channels: Float32Array[],
  sampleRate: number,
): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    sampleRate,
    length: channels[0].length,
    duration: channels[0].length / sampleRate,
    getChannelData: (channel: number) => channels[channel],
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

describe("useMp3Encoder", () => {
  test("isEncoding is false initially", () => {
    const { result } = renderHook(() => useMp3Encoder());
    expect(result.current.isEncoding).toBe(false);
  });

  test("isEncoding is true while encoding", async () => {
    const { result } = renderHook(() => useMp3Encoder());
    const audioBuffer = createMockAudioBuffer(
      [new Float32Array([0.5, -0.5])],
      44100,
    );

    act(() => {
      result.current.encode(audioBuffer);
    });

    expect(result.current.isEncoding).toBe(true);
  });

  test("posts encode message to worker with channel data", async () => {
    const { result } = renderHook(() => useMp3Encoder());
    const channelData = new Float32Array([0.5, -0.5]);
    const audioBuffer = createMockAudioBuffer([channelData], 44100);

    act(() => {
      result.current.encode(audioBuffer);
    });

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith(
      {
        type: "encode",
        channels: [channelData],
        sampleRate: 44100,
      },
      [channelData.buffer],
    );
  });

  test("resolves with Blob when worker sends encoded message", async () => {
    const { result } = renderHook(() => useMp3Encoder());
    const audioBuffer = createMockAudioBuffer(
      [new Float32Array([0.5])],
      44100,
    );

    let encodedBlob: Blob | undefined;

    await act(async () => {
      const promise = result.current.encode(audioBuffer);

      mockWorkerInstance.simulateMessage({
        type: "encoded",
        blob: new Blob(["mp3data"], { type: "audio/mpeg" }),
      });

      encodedBlob = await promise;
    });

    expect(encodedBlob).toBeInstanceOf(Blob);
    expect(encodedBlob!.type).toBe("audio/mpeg");
  });

  test("isEncoding returns to false after encoding completes", async () => {
    const { result } = renderHook(() => useMp3Encoder());
    const audioBuffer = createMockAudioBuffer(
      [new Float32Array([0.5])],
      44100,
    );

    await act(async () => {
      const promise = result.current.encode(audioBuffer);

      mockWorkerInstance.simulateMessage({
        type: "encoded",
        blob: new Blob(["mp3data"], { type: "audio/mpeg" }),
      });

      await promise;
    });

    expect(result.current.isEncoding).toBe(false);
  });

  test("rejects when worker sends error message", async () => {
    const { result } = renderHook(() => useMp3Encoder());
    const audioBuffer = createMockAudioBuffer(
      [new Float32Array([0.5])],
      44100,
    );

    await act(async () => {
      const promise = result.current.encode(audioBuffer);

      mockWorkerInstance.simulateError("Encoding failed");

      await expect(promise).rejects.toThrow("Encoding failed");
    });
  });

  test("isEncoding returns to false after error", async () => {
    const { result } = renderHook(() => useMp3Encoder());
    const audioBuffer = createMockAudioBuffer(
      [new Float32Array([0.5])],
      44100,
    );

    await act(async () => {
      const promise = result.current.encode(audioBuffer);

      mockWorkerInstance.simulateError("Encoding failed");

      await promise.catch(() => {});
    });

    expect(result.current.isEncoding).toBe(false);
  });

  test("handles stereo audio buffers", async () => {
    const { result } = renderHook(() => useMp3Encoder());
    const left = new Float32Array([0.5, -0.5]);
    const right = new Float32Array([0.3, -0.3]);
    const audioBuffer = createMockAudioBuffer([left, right], 44100);

    act(() => {
      result.current.encode(audioBuffer);
    });

    const postMessageCall = mockWorkerInstance.postMessage.mock.calls[0];
    expect(postMessageCall[0].channels).toHaveLength(2);
  });

  test("terminates worker on unmount", () => {
    const { unmount } = renderHook(() => useMp3Encoder());
    unmount();
    expect(mockWorkerInstance.terminate).toHaveBeenCalled();
  });
});
