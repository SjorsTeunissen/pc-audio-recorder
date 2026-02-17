import { describe, test, expect, vi, beforeEach } from "vitest";

const mockEncodeBuffer = vi.fn().mockReturnValue(new Int8Array([1, 2, 3]));
const mockFlush = vi.fn().mockReturnValue(new Int8Array([4, 5]));

vi.mock("lamejs", () => ({
  Mp3Encoder: vi.fn().mockImplementation(() => ({
    encodeBuffer: mockEncodeBuffer,
    flush: mockFlush,
  })),
}));

import { encode } from "./mp3-encoder.worker";

beforeEach(() => {
  vi.clearAllMocks();
  mockEncodeBuffer.mockReturnValue(new Int8Array([1, 2, 3]));
  mockFlush.mockReturnValue(new Int8Array([4, 5]));
});

describe("mp3-encoder worker encode()", () => {
  test("encodes mono audio and returns an audio/mpeg Blob", async () => {
    const channels = [new Float32Array([0.5, -0.5, 0.3])];
    const sampleRate = 44100;

    const blob = encode(channels, sampleRate);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("audio/mpeg");
  });

  test("encodes stereo audio and returns an audio/mpeg Blob", async () => {
    const channels = [
      new Float32Array([0.5, -0.5]),
      new Float32Array([0.3, -0.3]),
    ];
    const sampleRate = 44100;

    const blob = encode(channels, sampleRate);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("audio/mpeg");
  });

  test("converts Float32Array samples to Int16Array range", () => {
    const channels = [new Float32Array([1.0, -1.0, 0.0])];
    encode(channels, 44100);

    const callArgs = mockEncodeBuffer.mock.calls[0];
    const left = callArgs[0] as Int16Array;
    expect(left[0]).toBe(32767);
    expect(left[1]).toBe(-32768);
    expect(left[2]).toBe(0);
  });

  test("processes audio in chunks of 1152 samples", () => {
    const samples = new Float32Array(2400);
    encode([samples], 44100);

    // 2400 samples = 2 full chunks of 1152 + 1 partial chunk of 96
    expect(mockEncodeBuffer).toHaveBeenCalledTimes(3);
  });

  test("calls flush after encoding all chunks", () => {
    encode([new Float32Array(100)], 44100);

    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  test("collects all encoded data into the returned Blob", async () => {
    const blob = encode([new Float32Array(100)], 44100);

    const reader = new FileReader();
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve) => {
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob);
    });
    const bytes = new Uint8Array(arrayBuffer);

    // encodeBuffer returns [1,2,3], flush returns [4,5]
    expect(bytes).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
  });

  test("throws when channels array is empty", () => {
    expect(() => encode([], 44100)).toThrow();
  });
});
