import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import App from "./App";
import type { UseAudioRecorderReturn } from "./hooks/useAudioRecorder";

const mockStart = vi.fn();
const mockStop = vi.fn();
const mockPause = vi.fn();
const mockResume = vi.fn();

let mockReturnValue: UseAudioRecorderReturn;

vi.mock("./hooks/useAudioRecorder", () => ({
  useAudioRecorder: () => mockReturnValue,
}));

const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
const mockRevokeObjectURL = vi.fn();

beforeEach(() => {
  mockReturnValue = {
    start: mockStart,
    stop: mockStop,
    pause: mockPause,
    resume: mockResume,
    status: "idle",
    error: null,
    audioBlob: null,
    videoBlob: null,
    mode: "audio",
    duration: 0,
  };

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

describe("App", () => {
  describe("layout and structure", () => {
    it("renders with dark background styling", () => {
      const { container } = render(<App />);
      const root = container.firstElementChild as HTMLElement;
      expect(root).toHaveClass("min-h-screen");
      expect(root).toHaveClass("bg-[#09090b]");
    });

    it("renders the header with app title", () => {
      render(<App />);
      expect(screen.getByText("PC Audio Recorder")).toBeInTheDocument();
    });

    it("renders StatusIndicator in header showing Ready for idle state", () => {
      render(<App />);
      expect(screen.getByText("Ready")).toBeInTheDocument();
    });

    it("renders the PermissionGuide bar", () => {
      render(<App />);
      expect(screen.getByText(/click record/i)).toBeInTheDocument();
    });

    it("renders AudioPreview empty state", () => {
      render(<App />);
      expect(screen.getByText("Record something to preview it here")).toBeInTheDocument();
    });

    it("renders the REC button in idle state", () => {
      render(<App />);
      expect(screen.getByRole("button", { name: /rec/i })).toBeInTheDocument();
    });
  });

  describe("recording flow", () => {
    it("calls start when REC button is clicked", () => {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: /rec/i }));
      expect(mockStart).toHaveBeenCalledOnce();
    });

    it("shows recording controls when status is recording", () => {
      mockReturnValue.status = "recording";
      mockReturnValue.duration = 5;
      render(<App />);
      expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
      expect(screen.getByText("00:05")).toBeInTheDocument();
    });

    it("shows StatusIndicator as Recording when recording", () => {
      mockReturnValue.status = "recording";
      render(<App />);
      expect(screen.getByText("Recording")).toBeInTheDocument();
    });

    it("calls pause when pause button is clicked during recording", () => {
      mockReturnValue.status = "recording";
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: /pause/i }));
      expect(mockPause).toHaveBeenCalledOnce();
    });

    it("shows resume button when paused", () => {
      mockReturnValue.status = "paused";
      mockReturnValue.duration = 10;
      render(<App />);
      expect(screen.getByRole("button", { name: /resume/i })).toBeInTheDocument();
      expect(screen.getByText("Paused")).toBeInTheDocument();
    });

    it("calls resume when resume button is clicked", () => {
      mockReturnValue.status = "paused";
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: /resume/i }));
      expect(mockResume).toHaveBeenCalledOnce();
    });

    it("calls stop when stop button is clicked during recording", () => {
      mockReturnValue.status = "recording";
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: /stop/i }));
      expect(mockStop).toHaveBeenCalledOnce();
    });
  });

  describe("encoding state", () => {
    it("shows encoding indicator in StatusIndicator", () => {
      mockReturnValue.status = "encoding";
      render(<App />);
      const elements = screen.getAllByText("Encoding...");
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it("disables buttons during encoding", () => {
      mockReturnValue.status = "encoding";
      render(<App />);
      const buttons = screen.queryAllByRole("button");
      const controlButtons = buttons.filter(
        (btn) => btn.getAttribute("aria-label") !== "Dismiss",
      );
      controlButtons.forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });
  });

  describe("preview after recording", () => {
    it("renders audio element when audioBlob is available", () => {
      mockReturnValue.status = "stopped";
      mockReturnValue.audioBlob = new Blob(["mp3-data"], { type: "audio/mpeg" });
      render(<App />);
      const audio = document.querySelector("audio");
      expect(audio).toBeInTheDocument();
      expect(audio).toHaveAttribute("controls");
    });

    it("renders download link when audioBlob is available", () => {
      mockReturnValue.status = "stopped";
      mockReturnValue.audioBlob = new Blob(["mp3-data"], { type: "audio/mpeg" });
      render(<App />);
      const link = screen.getByRole("link", { name: /download/i });
      expect(link).toHaveAttribute("href", "blob:mock-url");
    });

    it("shows REC button again in stopped state for new recording", () => {
      mockReturnValue.status = "stopped";
      mockReturnValue.audioBlob = new Blob(["mp3-data"], { type: "audio/mpeg" });
      render(<App />);
      expect(screen.getByRole("button", { name: /rec/i })).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("displays error message in StatusIndicator", () => {
      mockReturnValue.status = "error";
      mockReturnValue.error = "System audio not shared.";
      render(<App />);
      expect(screen.getByText("System audio not shared.")).toBeInTheDocument();
    });

    it("shows REC button in error state so user can retry", () => {
      mockReturnValue.status = "error";
      mockReturnValue.error = "System audio not shared.";
      render(<App />);
      expect(screen.getByRole("button", { name: /rec/i })).toBeInTheDocument();
    });
  });

  describe("new recording clears preview", () => {
    it("clears audio preview when start is called after a previous recording", () => {
      mockReturnValue.status = "stopped";
      mockReturnValue.audioBlob = new Blob(["mp3-data"], { type: "audio/mpeg" });
      const { rerender } = render(<App />);
      expect(document.querySelector("audio")).toBeInTheDocument();

      mockReturnValue.status = "requesting";
      mockReturnValue.audioBlob = null;
      mockReturnValue.duration = 0;
      rerender(<App />);

      expect(document.querySelector("audio")).not.toBeInTheDocument();
      expect(screen.getByText("Record something to preview it here")).toBeInTheDocument();
    });
  });
});
