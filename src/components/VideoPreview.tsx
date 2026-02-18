import { useEffect, useRef, useState } from "react";
import { generateFilename } from "../utils/audio-helpers";

interface VideoPreviewProps {
  videoBlob: Blob | null;
}

export default function VideoPreview({ videoBlob }: VideoPreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const prevUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevUrlRef.current) {
      URL.revokeObjectURL(prevUrlRef.current);
    }

    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      setObjectUrl(url);
      prevUrlRef.current = url;
    } else {
      setObjectUrl(null);
      prevUrlRef.current = null;
    }

    return () => {
      if (prevUrlRef.current) {
        URL.revokeObjectURL(prevUrlRef.current);
      }
    };
  }, [videoBlob]);

  if (!videoBlob || !objectUrl) {
    return (
      <p className="text-center text-sm text-zinc-500">
        Record something to preview it here
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <video controls src={objectUrl} className="w-full max-w-md rounded-lg" />
      <a
        href={objectUrl}
        download={generateFilename("mp4")}
        className="inline-flex items-center gap-2 rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700"
      >
        Download
      </a>
    </div>
  );
}
