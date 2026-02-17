import { useState, useEffect, useRef, useCallback } from "react";

export function useMp3Encoder() {
  const [isEncoding, setIsEncoding] = useState(false);
  const workerRef = useRef<Worker | null>(null);

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

    setIsEncoding(true);

    const channels: Float32Array[] = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      channels.push(audioBuffer.getChannelData(i));
    }

    return new Promise<Blob>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent) => {
        const { type, blob, message } = e.data;
        if (type === "encoded") {
          setIsEncoding(false);
          resolve(blob);
        } else if (type === "error") {
          setIsEncoding(false);
          reject(new Error(message));
        }
      };

      worker.postMessage(
        { type: "encode", channels, sampleRate: audioBuffer.sampleRate },
        channels.map((c) => c.buffer),
      );
    });
  }, []);

  return { encode, isEncoding };
}
