import { useState, useRef, useCallback, useEffect } from "react";
import { useMp3Encoder } from "./useMp3Encoder";
import { mergeAudioStreams } from "../utils/audio-helpers";

export type RecordingStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "paused"
  | "stopped"
  | "encoding"
  | "error";

export interface UseAudioRecorderReturn {
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  status: RecordingStatus;
  error: string | null;
  audioBlob: Blob | null;
  duration: number;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const systemStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPausedRef = useRef(false);

  const { encode } = useMp3Encoder();

  const cleanupStreams = useCallback(() => {
    systemStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    systemStreamRef.current = null;
    micStreamRef.current = null;
  }, []);

  const cleanupInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    cleanupInterval();
    cleanupStreams();
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
    }
    audioContextRef.current = null;
    mediaRecorderRef.current = null;
  }, [cleanupInterval, cleanupStreams]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  const startDurationTimer = useCallback(() => {
    isPausedRef.current = false;
    intervalRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        setDuration((prev) => prev + 1);
      }
    }, 1000);
  }, []);

  const start = useCallback(async () => {
    setStatus("requesting");
    setError(null);
    setAudioBlob(null);
    setDuration(0);
    chunksRef.current = [];

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Stop video track immediately
      displayStream.getVideoTracks().forEach((track) => track.stop());

      // Check for system audio
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        displayStream.getTracks().forEach((t) => t.stop());
        setStatus("error");
        setError(
          "System audio not shared. Please enable 'Share audio' when sharing your screen.",
        );
        return;
      }

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      systemStreamRef.current = displayStream;
      micStreamRef.current = micStream;

      const { mergedStream, audioContext } = mergeAudioStreams(
        displayStream,
        micStream,
      );
      audioContextRef.current = audioContext;

      const recorder = new MediaRecorder(mergedStream, {
        mimeType: "audio/webm;codecs=opus",
      });

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        setStatus("encoding");
        try {
          const webmBlob = new Blob(chunksRef.current, {
            type: "audio/webm",
          });
          const arrayBuffer = await webmBlob.arrayBuffer();
          const decodeContext = new AudioContext();
          const audioBuffer = await decodeContext.decodeAudioData(arrayBuffer);
          await decodeContext.close();
          const mp3Blob = await encode(audioBuffer);
          setAudioBlob(mp3Blob);
          setStatus("stopped");
        } catch (encodeError) {
          setError(
            encodeError instanceof Error
              ? encodeError.message
              : "Encoding failed",
          );
          setStatus("error");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      startDurationTimer();
      setStatus("recording");
    } catch (err) {
      cleanupStreams();
      setStatus("error");
      setError(
        err instanceof Error ? err.message : "Failed to start recording",
      );
    }
  }, [encode, startDurationTimer, cleanupStreams]);

  const stop = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      cleanupInterval();
      mediaRecorderRef.current.stop();
      cleanupStreams();
    }
  }, [cleanupInterval, cleanupStreams]);

  const pause = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.pause();
      isPausedRef.current = true;
      setStatus("paused");
    }
  }, []);

  const resume = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "paused"
    ) {
      mediaRecorderRef.current.resume();
      isPausedRef.current = false;
      setStatus("recording");
    }
  }, []);

  return { start, stop, pause, resume, status, error, audioBlob, duration };
}
