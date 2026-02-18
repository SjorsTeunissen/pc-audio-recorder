import { useState, useEffect, useRef, useCallback } from "react";

const TIMEOUT_MS = 30_000;

export function useMp4Muxer() {
  const [isMuxing, setIsMuxing] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const muxingRef = useRef(false);
  const rejectRef = useRef<((reason: Error) => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spawnWorker = useCallback(() => {
    const worker = new Worker(
      new URL("../workers/mp4-muxer.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;
    return worker;
  }, []);

  useEffect(() => {
    spawnWorker();
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [spawnWorker]);

  const mux = useCallback((blob: Blob): Promise<Blob> => {
    const worker = workerRef.current;
    if (!worker) {
      return Promise.reject(new Error("Worker not initialized"));
    }

    if (muxingRef.current) {
      return Promise.reject(new Error("Muxing already in progress"));
    }

    muxingRef.current = true;
    setIsMuxing(true);

    return new Promise<Blob>((resolve, reject) => {
      rejectRef.current = reject;

      const cleanup = () => {
        muxingRef.current = false;
        setIsMuxing(false);
        worker.onmessage = null;
        worker.onerror = null;
        rejectRef.current = null;
        if (timeoutRef.current !== null) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
      };

      timeoutRef.current = setTimeout(() => {
        cleanup();
        reject(new Error("Muxing timed out"));
      }, TIMEOUT_MS);

      worker.onmessage = (e: MessageEvent) => {
        const { type, blob: resultBlob, message } = e.data;
        if (type === "muxed") {
          cleanup();
          resolve(resultBlob);
        } else if (type === "error") {
          cleanup();
          reject(new Error(message));
        }
      };

      worker.onerror = (e: ErrorEvent) => {
        cleanup();
        reject(new Error(e.message || "Worker error"));
      };

      worker.postMessage({ type: "mux", blob });
    });
  }, []);

  const cancel = useCallback(() => {
    if (rejectRef.current) {
      rejectRef.current(new Error("Muxing cancelled"));
      rejectRef.current = null;
    }
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    muxingRef.current = false;
    setIsMuxing(false);
    workerRef.current?.terminate();
    spawnWorker();
  }, [spawnWorker]);

  return { mux, cancel, isMuxing };
}
