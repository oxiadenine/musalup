export async function getInputStream() {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { max: 2, min: 1, ideal: 2 },
        sampleSize: { max: 32, min: 16, ideal: 32 },
        sampleRate: { max: 48000, min: 44100, ideal: 48000 },
        latency: { max: 10, min: 0, ideal: 0 },
        autoGainControl: { ideal: false },
        echoCancellation: { ideal: false },
        noiseSuppression: { ideal: false }
      }
    });
  } catch (error) {
    if (error.name === "NotAllowedError" || error.name === "SecurityError") {
      console.log("Input not allowed");
    } else if (error.name === "NotFoundError") {
      console.log("Input not found");
    } else {
      console.log(error);
    }
  }

  return null;
}
