import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMp4Muxer } from "./useMp4Muxer";

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

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockWorkerInstance = new MockWorker();
  vi.stubGlobal(
    "Worker",
    vi.fn(() => mockWorkerInstance),
  );
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useMp4Muxer", () => {
  test("spawns worker on mount", () => {
    renderHook(() => useMp4Muxer());
    expect(Worker).toHaveBeenCalledOnce();
  });

  test("terminates worker on unmount", () => {
    const { unmount } = renderHook(() => useMp4Muxer());
    unmount();
    expect(mockWorkerInstance.terminate).toHaveBeenCalled();
  });

  test("isMuxing is false initially", () => {
    const { result } = renderHook(() => useMp4Muxer());
    expect(result.current.isMuxing).toBe(false);
  });

  test("mux() sends blob to worker", () => {
    const { result } = renderHook(() => useMp4Muxer());
    const inputBlob = new Blob(["webm-data"], { type: "audio/webm" });

    act(() => {
      result.current.mux(inputBlob);
    });

    expect(mockWorkerInstance.postMessage).toHaveBeenCalledWith({
      type: "mux",
      blob: inputBlob,
    });
  });

  test("isMuxing is true while muxing", () => {
    const { result } = renderHook(() => useMp4Muxer());
    const inputBlob = new Blob(["webm-data"], { type: "audio/webm" });

    act(() => {
      result.current.mux(inputBlob);
    });

    expect(result.current.isMuxing).toBe(true);
  });

  test("mux() resolves with MP4 blob on success", async () => {
    const { result } = renderHook(() => useMp4Muxer());
    const inputBlob = new Blob(["webm-data"], { type: "audio/webm" });
    let mp4Blob: Blob | undefined;

    await act(async () => {
      const promise = result.current.mux(inputBlob);

      mockWorkerInstance.simulateMessage({
        type: "muxed",
        blob: new Blob(["mp4data"], { type: "video/mp4" }),
      });

      mp4Blob = await promise;
    });

    expect(mp4Blob).toBeInstanceOf(Blob);
    expect(mp4Blob!.type).toBe("video/mp4");
  });

  test("isMuxing returns to false after muxing completes", async () => {
    const { result } = renderHook(() => useMp4Muxer());
    const inputBlob = new Blob(["webm-data"], { type: "audio/webm" });

    await act(async () => {
      const promise = result.current.mux(inputBlob);
      mockWorkerInstance.simulateMessage({
        type: "muxed",
        blob: new Blob(["mp4data"], { type: "video/mp4" }),
      });
      await promise;
    });

    expect(result.current.isMuxing).toBe(false);
  });

  test("mux() rejects on worker error", async () => {
    const { result } = renderHook(() => useMp4Muxer());
    const inputBlob = new Blob(["webm-data"], { type: "audio/webm" });

    await act(async () => {
      const promise = result.current.mux(inputBlob);
      mockWorkerInstance.simulateError("Muxing failed");
      await expect(promise).rejects.toThrow("Muxing failed");
    });
  });

  test("isMuxing returns to false after error", async () => {
    const { result } = renderHook(() => useMp4Muxer());
    const inputBlob = new Blob(["webm-data"], { type: "audio/webm" });

    await act(async () => {
      const promise = result.current.mux(inputBlob);
      mockWorkerInstance.simulateError("Muxing failed");
      await promise.catch(() => {});
    });

    expect(result.current.isMuxing).toBe(false);
  });

  test("mux() rejects on timeout after 30 seconds", async () => {
    const { result } = renderHook(() => useMp4Muxer());
    const inputBlob = new Blob(["webm-data"], { type: "audio/webm" });

    await act(async () => {
      const promise = result.current.mux(inputBlob);
      vi.advanceTimersByTime(30_000);
      await expect(promise).rejects.toThrow("Muxing timed out");
    });
  });

  test("mux() rejects when worker not initialized", async () => {
    const { result, unmount } = renderHook(() => useMp4Muxer());
    unmount();

    await expect(result.current.mux(new Blob(["data"]))).rejects.toThrow(
      "Worker not initialized",
    );
  });

  test("concurrent mux() calls are rejected", async () => {
    const { result } = renderHook(() => useMp4Muxer());
    const inputBlob = new Blob(["webm-data"], { type: "audio/webm" });

    act(() => {
      result.current.mux(inputBlob);
    });

    await expect(result.current.mux(inputBlob)).rejects.toThrow(
      "Muxing already in progress",
    );
  });

  test("cancel() terminates current worker and spawns a new one", async () => {
    const { result } = renderHook(() => useMp4Muxer());
    const firstWorker = mockWorkerInstance;

    let muxPromise: Promise<Blob>;
    act(() => {
      muxPromise = result.current.mux(new Blob(["data"]));
    });

    const secondWorker = new MockWorker();
    (Worker as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => secondWorker,
    );

    act(() => {
      result.current.cancel();
    });

    await muxPromise!.catch(() => {});

    expect(firstWorker.terminate).toHaveBeenCalled();
    expect(Worker).toHaveBeenCalledTimes(2);
    expect(result.current.isMuxing).toBe(false);
  });

  test("cancel() rejects the pending mux() promise", async () => {
    const { result } = renderHook(() => useMp4Muxer());
    const inputBlob = new Blob(["webm-data"], { type: "audio/webm" });

    const secondWorker = new MockWorker();

    let muxPromise: Promise<Blob>;
    act(() => {
      muxPromise = result.current.mux(inputBlob);
    });

    (Worker as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => secondWorker,
    );

    act(() => {
      result.current.cancel();
    });

    await expect(muxPromise!).rejects.toThrow("Muxing cancelled");
  });

  test("mux() works after cancel()", async () => {
    const { result } = renderHook(() => useMp4Muxer());
    const inputBlob = new Blob(["webm-data"], { type: "audio/webm" });

    let firstPromise: Promise<Blob>;
    act(() => {
      firstPromise = result.current.mux(inputBlob);
    });

    const freshWorker = new MockWorker();
    (Worker as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () => freshWorker,
    );

    act(() => {
      result.current.cancel();
    });

    await firstPromise!.catch(() => {});

    let mp4Blob: Blob | undefined;
    await act(async () => {
      const promise = result.current.mux(inputBlob);
      freshWorker.simulateMessage({
        type: "muxed",
        blob: new Blob(["mp4data"], { type: "video/mp4" }),
      });
      mp4Blob = await promise;
    });

    expect(mp4Blob).toBeInstanceOf(Blob);
  });
});
