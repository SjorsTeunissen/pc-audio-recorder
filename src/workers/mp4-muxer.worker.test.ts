import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("mp4-muxer", () => ({
  Muxer: vi.fn().mockImplementation((opts) => ({
    addVideoChunkRaw: vi.fn(),
    addAudioChunkRaw: vi.fn(),
    finalize: vi.fn(),
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

  test("throws error for invalid input (null)", async () => {
    await expect(mux(null as unknown as Blob)).rejects.toThrow(
      "Invalid input: expected a Blob",
    );
  });
});

describe("mp4-muxer worker onmessage", () => {
  test('responds with { type: "muxed", blob } on success', async () => {
    const postMessageSpy = vi.fn();
    const originalPostMessage = self.postMessage;
    self.postMessage = postMessageSpy;

    const webmBlob = new Blob(["fake webm data"], { type: "video/webm" });

    // Call onmessage directly since jsdom doesn't route dispatchEvent to self.onmessage
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
});
