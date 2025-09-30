import { useRef, useState } from "react";
import { useTranslation } from "../../lib/intl.js";
import { getInputStream } from "../../lib/audio/audio-devices";
import "./audio-recorder.css";
import audioRecorderFile from "../../lib/audio/audio-recorder.js" with { type: "file" };
import audioEncoderFile from "../../lib/audio/audio-encoder.js" with { type: "file" };

const messages = {
  es: {
    button: {
      record: "Grabar",
      stop: "Parar"
    }
  },
  en: {
    button: {
      record: "Record",
      stop: "Stop"
    }
  }
};

export function AudioRecorder() {
  const [translate] = useTranslation("audio-recorder", messages);

  const audioContextRef = useRef(undefined);
  //const inputStreamRef = useRef(undefined);
  const inputStreamNodeRef = useRef(undefined);
  const audioRecorderNodeRef = useRef(undefined);
  
  const [isRecordingAllowed, setIsRecordingAllowed] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingLength, setRecordingLength] = useState(0.0);
  const [recordingFileUrl, setRecordingFileUrl] = useState(undefined);

  const recordingAudioElementRef = useRef(undefined);

  async function record() {
    setIsRecordingAllowed(false);

    const inputStream = await getInputStream();

    if (!inputStream) {
      return;
    }

    const audioTrack = inputStream.getAudioTracks()[0];
    const audioTrackSettings = audioTrack.getSettings();

    const channelCount = audioTrackSettings.channelCount;
    const sampleRate = audioTrackSettings.sampleRate ?? 48000;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    if (!inputStreamNodeRef.current) {
      inputStreamNodeRef.current = audioContextRef.current.createMediaStreamSource(inputStream);
    }

    if (!audioRecorderNodeRef.current) {
      await audioContextRef.current.audioWorklet.addModule(audioRecorderFile);

      audioRecorderNodeRef.current = new AudioWorkletNode(
        audioContextRef.current, 
        "recorder-worklet", 
        {
          outputChannelCount: [channelCount],
          processorOptions: {
            channelCount,
            sampleRate,
            recordingDuration: 10
          }
        }
      );

      audioRecorderNodeRef.current.port.onmessage = async ({ data }) => {
        if (data.type === "record") {
          setRecordingLength(data.recordingTime);
        } else if (data.type === "stop") {
          audioTrack.stop();

          inputStreamNodeRef.current.disconnect();
          inputStreamNodeRef.current = undefined;

          const audioEncoder = new Worker(audioEncoderFile);

          audioEncoder.onmessage = async ({ data }) => {
            if (data.type === "encode") {
              const recordingFile = new Blob([data.encodedData], { type: data.mimeType });

              setRecordingFileUrl(URL.createObjectURL(recordingFile));
            }
          };

          audioEncoder.postMessage({
            type: "encode",
            audioData: data.recordedData,
            frameCount: data.recordedFrameCount,
            sampleRate,
            use32bitFloat: true
          });

          setIsRecording(false);
        }
      };
    }

    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }

    audioRecorderNodeRef.current.port.postMessage({ type: "start" });

    inputStreamNodeRef.current.connect(audioRecorderNodeRef.current);

    setIsRecording(true);
    setIsRecordingAllowed(true);
  }

  async function stop() {
    audioRecorderNodeRef.current.port.postMessage({ type: "stop" });
  }

  return (
    <div className="audio-recorder">
      <div>
        <button disabled={!isRecordingAllowed || isRecording} onClick={record}>
          {translate("audio-recorder:button.record")}
        </button>
        <button disabled={!isRecording} onClick={stop}>
          {translate("audio-recorder:button.stop")}
        </button>
        <h5>{`${recordingLength.toFixed(2)}s`}</h5>
      </div>
      {recordingFileUrl && (
        <audio ref={recordingAudioElementRef} controls src={recordingFileUrl} />
      )}
    </div>
  );
}
