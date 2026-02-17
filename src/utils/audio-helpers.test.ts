import { describe, test, expect, vi, beforeEach } from "vitest";
import { mergeAudioStreams, formatDuration, generateFilename } from "./audio-helpers";

describe("formatDuration", () => {
  test("formats zero seconds", () => {
    expect(formatDuration(0)).toBe("00:00");
  });

  test("formats seconds only", () => {
    expect(formatDuration(5)).toBe("00:05");
  });

  test("formats minutes and seconds", () => {
    expect(formatDuration(65)).toBe("01:05");
  });

  test("formats hours, minutes, and seconds", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  test("pads single-digit minutes and seconds", () => {
    expect(formatDuration(61)).toBe("01:01");
  });

  test("does not pad hours", () => {
    expect(formatDuration(36000)).toBe("10:00:00");
  });
});

describe("generateFilename", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test("generates filename with correct format", () => {
    vi.setSystemTime(new Date("2026-02-16T14:30:22"));
    const filename = generateFilename();
    expect(filename).toBe("recording-2026-02-16-143022.mp3");
  });

  test("pads single-digit month, day, hour, minute, second", () => {
    vi.setSystemTime(new Date("2026-01-05T03:04:06"));
    const filename = generateFilename();
    expect(filename).toBe("recording-2026-01-05-030406.mp3");
  });

  test("filename ends with .mp3", () => {
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
    const filename = generateFilename();
    expect(filename).toMatch(/\.mp3$/);
  });

  test("filename starts with recording-", () => {
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));
    const filename = generateFilename();
    expect(filename).toMatch(/^recording-/);
  });
});

describe("mergeAudioStreams", () => {
  let mockSourceNode: { connect: ReturnType<typeof vi.fn> };
  let mockDestinationStream: object;
  let mockDestination: { stream: object };
  let mockAudioContext: {
    createMediaStreamSource: ReturnType<typeof vi.fn>;
    createMediaStreamDestination: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    state: string;
  };

  beforeEach(() => {
    mockSourceNode = { connect: vi.fn() };
    mockDestinationStream = { id: "merged-stream" };
    mockDestination = { stream: mockDestinationStream };
    mockAudioContext = {
      createMediaStreamSource: vi.fn(() => mockSourceNode),
      createMediaStreamDestination: vi.fn(() => mockDestination),
      close: vi.fn(),
      state: "running",
    };

    vi.stubGlobal(
      "AudioContext",
      vi.fn(() => mockAudioContext),
    );
  });

  test("creates AudioContext and merges two streams", () => {
    const systemStream = { id: "system" } as unknown as MediaStream;
    const micStream = { id: "mic" } as unknown as MediaStream;

    const result = mergeAudioStreams(systemStream, micStream);

    expect(AudioContext).toHaveBeenCalled();
    expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledTimes(2);
    expect(mockAudioContext.createMediaStreamDestination).toHaveBeenCalledTimes(1);
    expect(result.mergedStream).toBe(mockDestinationStream);
    expect(result.audioContext).toBe(mockAudioContext);
  });

  test("connects both sources to destination", () => {
    const systemStream = { id: "system" } as unknown as MediaStream;
    const micStream = { id: "mic" } as unknown as MediaStream;

    mergeAudioStreams(systemStream, micStream);

    expect(mockSourceNode.connect).toHaveBeenCalledTimes(2);
    expect(mockSourceNode.connect).toHaveBeenCalledWith(mockDestination);
  });
});
