export function mergeAudioStreams(
  systemStream: MediaStream,
  micStream: MediaStream,
): { mergedStream: MediaStream; audioContext: AudioContext } {
  const audioContext = new AudioContext();
  const systemSource = audioContext.createMediaStreamSource(systemStream);
  const micSource = audioContext.createMediaStreamSource(micStream);
  const destination = audioContext.createMediaStreamDestination();

  systemSource.connect(destination);
  micSource.connect(destination);

  return { mergedStream: destination.stream, audioContext };
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const paddedMins = String(mins).padStart(2, "0");
  const paddedSecs = String(secs).padStart(2, "0");

  if (hrs > 0) {
    return `${hrs}:${paddedMins}:${paddedSecs}`;
  }

  return `${paddedMins}:${paddedSecs}`;
}

export function generateFilename(extension = "mp3"): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return `recording-${year}-${month}-${day}-${hours}${minutes}${seconds}.${extension}`;
}
