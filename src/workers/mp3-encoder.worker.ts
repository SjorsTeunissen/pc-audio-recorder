import { Mp3Encoder } from "lamejs";

const CHUNK_SIZE = 1152;
const KBPS = 128;

function floatTo16Bit(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return int16;
}

export function encode(channels: Float32Array[], sampleRate: number): Blob {
  if (channels.length === 0) {
    throw new Error("No audio channels provided");
  }

  const numChannels = channels.length;
  const encoder = new Mp3Encoder(numChannels, sampleRate, KBPS);

  const left = floatTo16Bit(channels[0]);
  const right = numChannels > 1 ? floatTo16Bit(channels[1]) : null;

  const mp3Data: BlobPart[] = [];
  const totalSamples = left.length;

  for (let i = 0; i < totalSamples; i += CHUNK_SIZE) {
    const leftChunk = left.subarray(i, Math.min(i + CHUNK_SIZE, totalSamples));
    let mp3buf: Int8Array;
    if (numChannels === 1) {
      mp3buf = encoder.encodeBuffer(leftChunk);
    } else {
      const rightChunk = right!.subarray(
        i,
        Math.min(i + CHUNK_SIZE, totalSamples),
      );
      mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    }
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
  }

  const flushed = encoder.flush();
  if (flushed.length > 0) {
    mp3Data.push(new Uint8Array(flushed));
  }

  return new Blob(mp3Data, { type: "audio/mpeg" });
}

self.onmessage = (e: MessageEvent) => {
  const { type, channels, sampleRate } = e.data;

  if (type === "encode") {
    try {
      const blob = encode(channels, sampleRate);
      self.postMessage({ type: "encoded", blob });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      self.postMessage({ type: "error", message });
    }
  }
};
