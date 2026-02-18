import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import VideoPreview from "../components/VideoPreview";

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

describe("VideoPreview", () => {
  it("shows empty state when videoBlob is null", () => {
    render(<VideoPreview videoBlob={null} />);
    expect(
      screen.getByText("Record something to preview it here"),
    ).toBeInTheDocument();
  });

  it("renders video element when blob is provided", () => {
    const blob = new Blob(["video-data"], { type: "video/mp4" });
    render(<VideoPreview videoBlob={blob} />);

    const video = document.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("controls");
    expect(video).toHaveAttribute("src", "blob:mock-url");
  });

  it("renders download link with correct attributes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 1, 17, 14, 30, 45));

    const blob = new Blob(["video-data"], { type: "video/mp4" });
    render(<VideoPreview videoBlob={blob} />);

    const link = screen.getByRole("link", { name: /download/i });
    expect(link).toHaveAttribute("href", "blob:mock-url");
    expect(link).toHaveAttribute("download", "recording-2026-02-17-143045.mp4");

    vi.useRealTimers();
  });

  it("revokes previous object URL when blob changes", () => {
    const blob1 = new Blob(["video-1"], { type: "video/mp4" });
    const blob2 = new Blob(["video-2"], { type: "video/mp4" });

    mockCreateObjectURL.mockReturnValueOnce("blob:url-1").mockReturnValueOnce("blob:url-2");

    const { rerender } = render(<VideoPreview videoBlob={blob1} />);
    rerender(<VideoPreview videoBlob={blob2} />);

    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:url-1");
  });

  it("revokes object URL on unmount", () => {
    const blob = new Blob(["video-data"], { type: "video/mp4" });

    mockCreateObjectURL.mockReturnValue("blob:unmount-url");

    const { unmount } = render(<VideoPreview videoBlob={blob} />);
    unmount();

    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:unmount-url");
  });
});
