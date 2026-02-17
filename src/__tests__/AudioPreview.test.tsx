import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AudioPreview from "../components/AudioPreview";

const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  mockCreateObjectURL.mockReturnValue("blob:mock-url");
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: mockCreateObjectURL,
    revokeObjectURL: mockRevokeObjectURL,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe("AudioPreview", () => {
  it("shows empty state when audioBlob is null", () => {
    render(<AudioPreview audioBlob={null} />);
    expect(
      screen.getByText("Record something to preview it here"),
    ).toBeInTheDocument();
  });

  it("renders audio element when blob is provided", () => {
    const blob = new Blob(["audio-data"], { type: "audio/mpeg" });
    render(<AudioPreview audioBlob={blob} />);

    const audio = document.querySelector("audio");
    expect(audio).toBeInTheDocument();
    expect(audio).toHaveAttribute("controls");
    expect(audio).toHaveAttribute("src", "blob:mock-url");
  });

  it("renders download link with correct attributes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 17, 14, 30, 45));

    const blob = new Blob(["audio-data"], { type: "audio/mpeg" });
    render(<AudioPreview audioBlob={blob} />);

    const link = screen.getByRole("link", { name: /download/i });
    expect(link).toHaveAttribute("href", "blob:mock-url");
    expect(link).toHaveAttribute("download", "recording-2026-02-17-143045.mp3");

    vi.useRealTimers();
  });

  it("revokes previous object URL when blob changes", () => {
    const blob1 = new Blob(["audio-1"], { type: "audio/mpeg" });
    const blob2 = new Blob(["audio-2"], { type: "audio/mpeg" });

    mockCreateObjectURL.mockReturnValueOnce("blob:url-1").mockReturnValueOnce("blob:url-2");

    const { rerender } = render(<AudioPreview audioBlob={blob1} />);
    rerender(<AudioPreview audioBlob={blob2} />);

    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:url-1");
  });
});
