import { Muxer, ArrayBufferTarget } from "mp4-muxer";

export async function mux(webmBlob: Blob): Promise<Blob> {
  if (!webmBlob || !(webmBlob instanceof Blob)) {
    throw new Error("Invalid input: expected a Blob");
  }

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: "avc",
      width: 1280,
      height: 720,
    },
    fastStart: "in-memory",
  });

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
