import { useState, useEffect, useRef, useCallback } from "react";

export function useMp3Encoder() {
  const [isEncoding, setIsEncoding] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const encodingRef = useRef(false);

  useEffect(() => {
    const worker = new Worker(
      new URL("../workers/mp3-encoder.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const encode = useCallback((audioBuffer: AudioBuffer): Promise<Blob> => {
    const worker = workerRef.current;
    if (!worker) {
      return Promise.reject(new Error("Worker not initialized"));
    }

    if (encodingRef.current) {
      return Promise.reject(new Error("Encoding already in progress"));
    }

    encodingRef.current = true;
    setIsEncoding(true);

    const channels: Float32Array[] = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(new Float32Array(audioBuffer.getChannelData(i)));
    }

    return new Promise<Blob>((resolve, reject) => {
      const cleanup = () => {
        encodingRef.current = false;
        setIsEncoding(false);
        worker.onmessage = null;
        worker.onerror = null;
      };

      worker.onmessage = (e: MessageEvent) => {
        const { type, blob, message } = e.data;
        if (type === "encoded") {
          cleanup();
          resolve(blob);
        } else if (type === "error") {
          cleanup();
          reject(new Error(message));
        }
      };

      worker.onerror = (e: ErrorEvent) => {
        cleanup();
        reject(new Error(e.message || "Worker error"));
      };

      worker.postMessage(
        { type: "encode", channels, sampleRate: audioBuffer.sampleRate },
        channels.map((c) => c.buffer),
      );
    });
  }, []);

  return { encode, isEncoding };
}
