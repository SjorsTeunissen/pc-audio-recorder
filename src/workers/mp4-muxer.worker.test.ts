import { describe, test, expect, vi, beforeEach } from "vitest";

const mockAddAudioChunkRaw = vi.fn();
const mockFinalize = vi.fn();

vi.mock("mp4-muxer", () => ({
  Muxer: vi.fn().mockImplementation((opts) => ({
    addAudioChunkRaw: mockAddAudioChunkRaw,
    finalize: mockFinalize,
    target: opts.target,
  })),
  ArrayBufferTarget: vi.fn().mockImplementation(() => ({
    buffer: new ArrayBuffer(10),
  })),
}));

import { mux } from "./mp4-muxer.worker";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("mp4-muxer worker mux()", () => {
  test("converts a valid WebM blob to an MP4 blob", async () => {
    const webmBlob = new Blob(["fake webm data"], { type: "video/webm" });

    const result = await mux(webmBlob);

    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe("video/mp4");
  });

  test("reads the input blob data and passes it to the muxer", async () => {
    const webmBlob = new Blob(["fake webm data"], { type: "video/webm" });

    await mux(webmBlob);

    expect(mockAddAudioChunkRaw).toHaveBeenCalledTimes(1);
    const rawData = mockAddAudioChunkRaw.mock.calls[0][0];
    expect(rawData).toBeInstanceOf(Uint8Array);
    expect(rawData.length).toBeGreaterThan(0);
  });

  test("calls finalize after adding audio data", async () => {
    const webmBlob = new Blob(["fake webm data"], { type: "video/webm" });

    await mux(webmBlob);

    expect(mockFinalize).toHaveBeenCalledTimes(1);
    // finalize should be called after addAudioChunkRaw
    const addOrder = mockAddAudioChunkRaw.mock.invocationCallOrder[0];
    const finalizeOrder = mockFinalize.mock.invocationCallOrder[0];
    expect(addOrder).toBeLessThan(finalizeOrder);
  });

  test("throws error for invalid input (null)", async () => {
    await expect(mux(null as unknown as Blob)).rejects.toThrow(
      "Invalid input: expected a Blob",
    );
  });

  test("throws error for empty blob", async () => {
    const emptyBlob = new Blob([], { type: "video/webm" });
    await expect(mux(emptyBlob)).rejects.toThrow(
      "Invalid input: blob is empty",
    );
  });

  test("uses custom audio options when provided", async () => {
    const { Muxer } = await import("mp4-muxer");
    const webmBlob = new Blob(["fake webm data"], { type: "video/webm" });

    await mux(webmBlob, {
      codec: "aac",
      numberOfChannels: 2,
      sampleRate: 44100,
    });

    expect(Muxer).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: {
          codec: "aac",
          numberOfChannels: 2,
          sampleRate: 44100,
        },
      }),
    );
  });
});

describe("mp4-muxer worker onmessage", () => {
  test('responds with { type: "muxed", blob } on success', async () => {
    const postMessageSpy = vi.fn();
    const originalPostMessage = self.postMessage;
    self.postMessage = postMessageSpy;

    const webmBlob = new Blob(["fake webm data"], { type: "video/webm" });

    await self.onmessage!(
      new MessageEvent("message", {
        data: { type: "mux", blob: webmBlob },
      }),
    );

    expect(postMessageSpy).toHaveBeenCalledTimes(1);
    const response = postMessageSpy.mock.calls[0][0];
    expect(response.type).toBe("muxed");
    expect(response.blob).toBeInstanceOf(Blob);
    expect(response.blob.type).toBe("video/mp4");

    self.postMessage = originalPostMessage;
  });

  test('responds with { type: "error", message } on failure', async () => {
    const postMessageSpy = vi.fn();
    const originalPostMessage = self.postMessage;
    self.postMessage = postMessageSpy;

    await self.onmessage!(
      new MessageEvent("message", {
        data: { type: "mux", blob: null },
      }),
    );

    expect(postMessageSpy).toHaveBeenCalledTimes(1);
    const response = postMessageSpy.mock.calls[0][0];
    expect(response.type).toBe("error");
    expect(response.message).toBe("Invalid input: expected a Blob");

    self.postMessage = originalPostMessage;
  });

  test("silently ignores unrecognized message types", async () => {
    const postMessageSpy = vi.fn();
    const originalPostMessage = self.postMessage;
    self.postMessage = postMessageSpy;

    await self.onmessage!(
      new MessageEvent("message", {
        data: { type: "unknown" },
      }),
    );

    expect(postMessageSpy).not.toHaveBeenCalled();

    self.postMessage = originalPostMessage;
  });
});
