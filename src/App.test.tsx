import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";

const mockStart = vi.fn();
const mockStop = vi.fn();
const mockPause = vi.fn();
const mockResume = vi.fn();

const defaultHookReturn = {
  start: mockStart,
  stop: mockStop,
  pause: mockPause,
  resume: mockResume,
  status: "idle" as const,
  error: null,
  audioBlob: null,
  duration: 0,
};

vi.mock("./hooks/useAudioRecorder", () => ({
  useAudioRecorder: vi.fn(() => defaultHookReturn),
}));

import { useAudioRecorder } from "./hooks/useAudioRecorder";

function renderWithHook(overrides = {}) {
  vi.mocked(useAudioRecorder).mockReturnValue({
    ...defaultHookReturn,
    ...overrides,
  });
  return render(<App />);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("App", () => {
  it("renders the heading", () => {
    renderWithHook();
    expect(screen.getByText("PC Audio Recorder")).toBeInTheDocument();
  });

  it("renders with dark theme background", () => {
    const { container } = renderWithHook();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("min-h-screen");
    expect(root.className).toContain("bg-[#09090b]");
  });

  it("renders StatusIndicator showing Ready in idle state", () => {
    renderWithHook();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("renders RecordingControls with record button in idle state", () => {
    renderWithHook();
    expect(screen.getByRole("button", { name: /rec/i })).toBeInTheDocument();
  });

  it("renders AudioPreview placeholder when no blob", () => {
    renderWithHook();
    expect(
      screen.getByText("Record something to preview it here"),
    ).toBeInTheDocument();
  });

  it("renders PermissionGuide", () => {
    renderWithHook();
    expect(screen.getByText(/click record/i)).toBeInTheDocument();
  });

  it("passes hook start to RecordingControls onStart", () => {
    renderWithHook();
    fireEvent.click(screen.getByRole("button", { name: /rec/i }));
    expect(mockStart).toHaveBeenCalledOnce();
  });

  it("shows recording controls during recording state", () => {
    renderWithHook({ status: "recording", duration: 5 });
    expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
  });

  it("passes hook pause to RecordingControls onPause", () => {
    renderWithHook({ status: "recording" });
    fireEvent.click(screen.getByRole("button", { name: /pause/i }));
    expect(mockPause).toHaveBeenCalledOnce();
  });

  it("passes hook stop to RecordingControls onStop", () => {
    renderWithHook({ status: "recording" });
    fireEvent.click(screen.getByRole("button", { name: /stop/i }));
    expect(mockStop).toHaveBeenCalledOnce();
  });

  it("passes hook resume to RecordingControls onResume", () => {
    renderWithHook({ status: "paused" });
    fireEvent.click(screen.getByRole("button", { name: /resume/i }));
    expect(mockResume).toHaveBeenCalledOnce();
  });

  it("shows error in StatusIndicator when error occurs", () => {
    renderWithHook({ status: "error", error: "Permission denied" });
    expect(screen.getByText("Permission denied")).toBeInTheDocument();
  });

  it("shows encoding state", () => {
    renderWithHook({ status: "encoding" });
    const elements = screen.getAllByText("Encoding...");
    expect(elements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders two panel cards in the main content area", () => {
    const { container } = renderWithHook();
    const cards = container.querySelectorAll(".rounded-xl.border.border-zinc-700");
    expect(cards.length).toBeGreaterThanOrEqual(2);
  });
});
