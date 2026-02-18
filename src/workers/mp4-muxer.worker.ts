import { Muxer, ArrayBufferTarget } from "mp4-muxer";

export interface MuxOptions {
  codec?: "aac" | "opus";
  numberOfChannels?: number;
  sampleRate?: number;
}

const DEFAULTS: Required<MuxOptions> = {
  codec: "opus",
  numberOfChannels: 1,
  sampleRate: 48000,
};

export async function mux(
  webmBlob: Blob,
  options?: MuxOptions,
): Promise<Blob> {
  if (!webmBlob || !(webmBlob instanceof Blob)) {
    throw new Error("Invalid input: expected a Blob");
  }

  if (webmBlob.size === 0) {
    throw new Error("Invalid input: blob is empty");
  }

  const opts = { ...DEFAULTS, ...options };
  const arrayBuffer = await new Response(webmBlob).arrayBuffer();
  const rawData = new Uint8Array(arrayBuffer);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    audio: {
      codec: opts.codec,
      numberOfChannels: opts.numberOfChannels,
      sampleRate: opts.sampleRate,
    },
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  muxer.addAudioChunkRaw(rawData, "key", 0, 0);
  muxer.finalize();

  const { buffer } = muxer.target as ArrayBufferTarget;
  return new Blob([buffer], { type: "video/mp4" });
}

self.onmessage = async (e: MessageEvent) => {
  const { type, blob } = e.data;

  if (type === "mux") {
    try {
      const mp4Blob = await mux(blob);
      self.postMessage({ type: "muxed", blob: mp4Blob });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      self.postMessage({ type: "error", message });
    }
  }
};
