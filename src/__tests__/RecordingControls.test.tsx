import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import RecordingControls from "../components/RecordingControls";

function renderControls(overrides = {}) {
  const props = {
    status: "idle" as const,
    duration: 0,
    onStart: vi.fn(),
    onStop: vi.fn(),
    onPause: vi.fn(),
    onResume: vi.fn(),
    ...overrides,
  };
  render(<RecordingControls {...props} />);
  return props;
}

describe("RecordingControls", () => {
  describe("idle state", () => {
    it("shows only the record button", () => {
      renderControls({ status: "idle" });
      expect(screen.getByRole("button", { name: /rec/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /pause/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /stop/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /resume/i })).not.toBeInTheDocument();
    });

    it("fires onStart when record button is clicked", () => {
      const props = renderControls({ status: "idle" });
      fireEvent.click(screen.getByRole("button", { name: /rec/i }));
      expect(props.onStart).toHaveBeenCalledOnce();
    });
  });

  describe("stopped state", () => {
    it("shows only the record button", () => {
      renderControls({ status: "stopped" });
      expect(screen.getByRole("button", { name: /rec/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /pause/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /stop/i })).not.toBeInTheDocument();
    });
  });

  describe("recording state", () => {
    it("shows pause and stop buttons, hides record", () => {
      renderControls({ status: "recording", duration: 5 });
      expect(screen.queryByRole("button", { name: /rec/i })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /pause/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
    });

    it("displays formatted duration", () => {
      renderControls({ status: "recording", duration: 65 });
      expect(screen.getByText("01:05")).toBeInTheDocument();
    });

    it("fires onPause when pause is clicked", () => {
      const props = renderControls({ status: "recording" });
      fireEvent.click(screen.getByRole("button", { name: /pause/i }));
      expect(props.onPause).toHaveBeenCalledOnce();
    });

    it("fires onStop when stop is clicked", () => {
      const props = renderControls({ status: "recording" });
      fireEvent.click(screen.getByRole("button", { name: /stop/i }));
      expect(props.onStop).toHaveBeenCalledOnce();
    });
  });

  describe("paused state", () => {
    it("shows resume and stop buttons", () => {
      renderControls({ status: "paused", duration: 10 });
      expect(screen.getByRole("button", { name: /resume/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /pause/i })).not.toBeInTheDocument();
    });

    it("displays frozen duration", () => {
      renderControls({ status: "paused", duration: 10 });
      expect(screen.getByText("00:10")).toBeInTheDocument();
    });

    it("fires onResume when resume is clicked", () => {
      const props = renderControls({ status: "paused" });
      fireEvent.click(screen.getByRole("button", { name: /resume/i }));
      expect(props.onResume).toHaveBeenCalledOnce();
    });
  });

  describe("encoding state", () => {
    it("disables all buttons and shows encoding indicator", () => {
      renderControls({ status: "encoding" });
      expect(screen.getByText(/encoding/i)).toBeInTheDocument();
      const buttons = screen.queryAllByRole("button");
      buttons.forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });
  });
});
