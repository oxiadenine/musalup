import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../lib/intl.js";
import { getInputStream } from "../../lib/audio/audio-devices";
import "./audio-looper.css";
import looperWorkletFile from "../../lib/audio/audio-looper-worklet.js" with { type: "file" };

const messages = {
  es: {
    text: {
      recording: "Grabando",
      waiting: "Esperando",
      playing: "Reproduciendo",
      rsl: "NSG (dB)",
      bpm: "PPM"
    }
  },
  en: {
    text: {
      recording: "Recording",
      waiting: "Waiting",
      playing: "Playing",
      rsl: "RSL (dB)",
      bpm: "BPM"
    }
  }
};

export function AudioLooper() {
  const [translate] = useTranslation("audio-looper", messages);

  const inputStreamRef = useRef(undefined);
  const audioContextRef = useRef(undefined);
  const inputStreamSourceNodeRef = useRef(undefined);
  const looperWorkletNodeRef = useRef(undefined);

  const defaultSampleRate = 48000;
  const defaultRecordingDuration = 300;
  const defaultRecordingMonitoringGain = 0.8;
  const defaultRecordingSilenceLevel = -32 // dBFS;
  const defaultLoopGain = Math.pow(10, -4 / 20); // -4 dBFS
  const defaultLoopBeatsPerMinute = 120;
  const defaultMetronomeGain = 0.8;

  const [isRecordingAllowed, setIsRecordingAllowed] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingWaiting, setIsRecordingWaiting] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const [isRecordingMonitoringMuted, setIsRecordingMonitoringMuted] = useState(true);
  const [recordingMonitoringGain, setRecordingMonitoringGain] = useState(defaultRecordingMonitoringGain);
  const [isRecordingWaitEnabled, setIsRecordingWaitEnabled] = useState(true);
  const [recordingSilenceLevel, setRecordingSilenceLevel] = useState(defaultRecordingSilenceLevel);

  const [loopGain, setLoopGain] = useState(defaultLoopGain);
  const [loopBeatsPerMinute, setLoopBeatsPerMinute] = useState(defaultLoopBeatsPerMinute);

  const [loopLayerCount, setLoopLayerCount] = useState(0);
  const [loopDuration, setLoopDuration] = useState(0);
  const [loopBeatCount, setLoopBeatCount] = useState(0);
  const [loopTime, setLoopTime] = useState(0);
  const [loopBeat, setLoopBeat] = useState(0);

  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(true);
  const [metronomeGain, setMetronomeGain] = useState(defaultMetronomeGain);

  const handleKeyEventRef = useRef(handleKeyEvent);

  async function initializeAudio() {
    inputStreamRef.current = await getInputStream();

    if (!inputStreamRef.current) {
      setIsRecordingAllowed(false);

      return;
    }

    const audioTracks = inputStreamRef.current.getAudioTracks();
    const audioTrackSettings = audioTracks[0].getSettings();

    const channelCount = audioTrackSettings.channelCount;
    const sampleRate = audioTrackSettings.sampleRate ?? defaultSampleRate;

    audioContextRef.current = new AudioContext({
      sampleRate,
      latencyHint: "interactive"
    });

    inputStreamSourceNodeRef.current = audioContextRef.current
      .createMediaStreamSource(inputStreamRef.current);

    await audioContextRef.current.audioWorklet.addModule(looperWorkletFile);

    looperWorkletNodeRef.current = new AudioWorkletNode(
      audioContextRef.current,
      "looper-worklet",
      {
        numberOfOutputs: [3],
        outputChannelCount: [channelCount, channelCount, channelCount],
        processorOptions: {
          recordingDuration: defaultRecordingDuration,
          isRecordingMonitoringMuted,
          recordingMonitoringGain,
          isRecordingWaitEnabled,
          recordingSilenceLevel: Math.pow(10, defaultRecordingSilenceLevel / 20),
          loopGain,
          loopBeatsPerMinute,
          isMetronomeEnabled,
          metronomeGain
        }
      }
    );

    looperWorkletNodeRef.current.port.onmessage = ({ data }) => {
      if (data.type === "recording-start") {
        setIsRecording(true);
        setIsRecordingWaiting(false);
      } if (data.type === "recording-wait") {
        setIsRecordingWaiting(true);
      } else if (data.type === "recording-stop") {
        setIsRecording(false);
        setIsRecordingWaiting(false);

        if (data.loopDuration) {
          setLoopDuration(data.loopDuration);
          setLoopBeatCount(data.loopBeatCount);
          setIsMetronomeEnabled(false);
        }
      } else if (data.type === "loop-start") {
        setIsPlaying(true);
      } else if (data.type === "loop-stop") {
        setIsPlaying(false);
        setLoopTime(0);
        setLoopBeat(0);
      } else if (data.type === "loop-clear") {
        setLoopDuration(0);
        setLoopLayerCount(0);
        setIsMetronomeEnabled(true);
      } else if (data.type === "loop-layer-add") {
        setLoopLayerCount(data.loopLayerCount);
      } else if (data.type === "loop-layer-remove") {
        setLoopLayerCount(data.loopLayerCount);
      } else if (data.type === "loop-beat-update") {
        setLoopBeat(data.loopBeat);
      } else if (data.type === "loop-time-update") {
        setLoopTime(data.loopTime);
      }
    };

    inputStreamSourceNodeRef.current.connect(looperWorkletNodeRef.current);
    looperWorkletNodeRef.current.connect(audioContextRef.current.destination, 0, 0);
    looperWorkletNodeRef.current.connect(audioContextRef.current.destination, 1, 0);
    looperWorkletNodeRef.current.connect(audioContextRef.current.destination, 2, 0);

    setIsRecordingAllowed(true);
  }

  async function freeAudioResources() {
    if (inputStreamRef.current) {
      const audioTracks = inputStreamRef.current.getAudioTracks();

      audioTracks.forEach((audioTrack) => audioTrack.stop());
    }

    if (inputStreamSourceNodeRef.current) {
      inputStreamSourceNodeRef.current.disconnect();
    }

    if (looperWorkletNodeRef.current) {
      looperWorkletNodeRef.current.disconnect();
    }
    
    if (audioContextRef.current) {
      await audioContextRef.current.close();
    }
  }

  function startRecording() {
    looperWorkletNodeRef.current.port.postMessage({ type: "recording-start" });
  }

  function waitRecording() {
    looperWorkletNodeRef.current.port.postMessage({ type: "recording-wait" });
  }

  function stopRecording() {
    looperWorkletNodeRef.current.port.postMessage({ type: "recording-stop" });
  }

  function toggleRecordingMonitoringMute() {
    looperWorkletNodeRef.current.port.postMessage({
      type: "recording-monitoring-mute-enable",
      isRecordingMonitoringMuted: !isRecordingMonitoringMuted
    });

    setIsRecordingMonitoringMuted(!isRecordingMonitoringMuted);
  }

  function changeRecordingMonitoringGain(event) {
    const recordingMonitoringGain = event.target.value;

    looperWorkletNodeRef.current.port.postMessage({
      type: "recording-monitoring-gain-change",
      recordingMonitoringGain
    });

    setRecordingMonitoringGain(recordingMonitoringGain);
  }

  function toggleRecordingWaitEnable() {
    looperWorkletNodeRef.current.port.postMessage({
      type: "recording-wait-enable",
      isRecordingWaitEnabled: !isRecordingWaitEnabled
    });

    setIsRecordingWaitEnabled(!isRecordingWaitEnabled);
  }

  function changeRecordingSilenceLevel(event) {
    const recordingSilenceLevel = event.target.value;

    looperWorkletNodeRef.current.port.postMessage({
      type: "recording-silence-level-change",
      recordingSilenceLevel: Math.pow(10, recordingSilenceLevel / 20)
    });

    setRecordingSilenceLevel(recordingSilenceLevel);
  }

  function changeLoopGain(event) {
    const loopGain = event.target.value;

    looperWorkletNodeRef.current.port.postMessage({
      type: "loop-gain-change",
      loopGain
    });

    setLoopGain(loopGain);
  }

  function changeLoopBeatsPerMinute(event) {
    const loopBeatsPerMinute = event.target.value;

    looperWorkletNodeRef.current.port.postMessage({
      type: "loop-bpm-change",
      loopBeatsPerMinute
    });

    setLoopBeatsPerMinute(loopBeatsPerMinute);
  }

  function startLoop() {
    looperWorkletNodeRef.current.port.postMessage({ type: "loop-start" });
  }

  function stopLoop() {
    looperWorkletNodeRef.current.port.postMessage({ type: "loop-stop" });
  }

  function clearLoop() {
    looperWorkletNodeRef.current.port.postMessage({ type: "loop-clear" });
  }

  function removeLoopLayer() {
    looperWorkletNodeRef.current.port.postMessage({ type: "loop-layer-remove" });
  }

  function toggleMetronomeEnable() {
    looperWorkletNodeRef.current.port.postMessage({
      type: "metronome-enable",
      isMetronomeEnabled: !isMetronomeEnabled
    });

    setIsMetronomeEnabled(!isMetronomeEnabled);
  }

  function changeMetronomeGain(event) {
    const metronomeGain = event.target.value;

    looperWorkletNodeRef.current.port.postMessage({
      type: "metronome-gain-change",
      metronomeGain
    });

    setMetronomeGain(metronomeGain);
  }

  function handleKeyEvent(event) {
    event.preventDefault();

    if (!isRecordingAllowed) {
      return;
    }

    if (event.code === "Space") {
      if (isRecordingWaitEnabled) {
        if (!isRecording && !isRecordingWaiting) {
          waitRecording();
        } else {
          stopRecording();
        }
      } else {
        if (!isRecording) {
          startRecording()
        } else {
          stopRecording();
        }
      }
    }

    if (isRecording || isRecordingWaiting || loopLayerCount === 0) {
      return;
    }
    
    if (event.code === "Enter") {
      if (isPlaying) {
        stopLoop();
      } else {
        startLoop();
      }
    } else if (event.code === "Backspace" && event.shiftKey) {
      if (!isPlaying) {
        clearLoop();
      }
    } else if (event.code === "Backspace") {
      if (!isPlaying && loopLayerCount > 1) {
        removeLoopLayer();
      }
    }
  }

  useEffect(() => {
    initializeAudio();

    return () => {
      freeAudioResources();
    };
  }, []);

  useEffect(() => {
    handleKeyEventRef.current = handleKeyEvent;
  }, [
    isRecordingAllowed,
    isRecordingWaitEnabled,
    isRecording,
    isRecordingWaiting,
    isPlaying,
    loopLayerCount
  ]);

  useEffect(() => {
    const handleKeyEvent = (event) => handleKeyEventRef.current(event);

    document.addEventListener("keydown", handleKeyEvent);

    return () => {
      document.removeEventListener("keydown", handleKeyEvent);
    };
  }, []);

  return (
    <div className="audio-looper">
      <div>
        <h3>Looper</h3>
        <h5>
          {isRecording && !isRecordingWaiting && translate("audio-looper:text.recording")}
          {!isRecording && isRecordingWaiting && translate("audio-looper:text.waiting")}
          {!isRecording && !isRecordingWaiting && isPlaying && translate("audio-looper:text.playing")}
        </h5>
      </div>
      <div>
        {loopLayerCount > 0 && (
          <button
            disabled={!isRecordingAllowed || isRecording || isRecordingWaiting}
            onClick={!isPlaying ? startLoop : stopLoop}
          >
            {!isPlaying ? <>&#x25b6;</> : <>&#x25a9;</>}
          </button>
        )}
        <progress max={loopDuration} value={loopTime} />
        {isRecording && loopLayerCount === 0 && <h5>{loopBeat}</h5>}
        {loopLayerCount > 0 && <h5>{`${loopBeat}/${loopBeatCount} (${loopLayerCount})`}</h5>}
        {loopLayerCount > 0 && (
          <div>
            <button
              disabled={!isRecordingAllowed || isRecording || isRecordingWaiting 
                || isPlaying || loopLayerCount <= 1
              }
              onClick={removeLoopLayer}
            >
              &#x2baa;
            </button>
            <button
              disabled={!isRecordingAllowed || isRecording || isRecordingWaiting || isPlaying}
              onClick={clearLoop}
            >
              &#x267b;
            </button>
          </div>
        )}
      </div>
      <div>
        <div>
          <input
            type="range"
            disabled={!isRecordingAllowed || isRecording || isRecordingWaiting}
            min={0.1}
            max={1}
            step={0.01}
            defaultValue={defaultLoopGain}
            onChange={changeLoopGain}
          />
          <div>
            <h5>{translate("audio-looper:text.bpm")}</h5>
            <input
              type="number"
              disabled={!isRecordingAllowed || isRecording || isRecordingWaiting 
                || loopLayerCount > 0
              }
              min={30}
              max={300}
              value={loopBeatsPerMinute}
              onChange={changeLoopBeatsPerMinute}
              onKeyDown={(event) => event.preventDefault()}
            />
          </div>
        </div>
        <div>
          <button
            disabled={!isRecordingAllowed}
            onClick={isRecordingWaitEnabled
              ? !isRecording && !isRecordingWaiting ? waitRecording : stopRecording
              : !isRecording ? startRecording : stopRecording
            }
          >
            {isRecordingWaitEnabled 
              ? !isRecording && !isRecordingWaiting ? <>&#x25cb;</> : <>&#x25cf;</>
              : !isRecording ? <>&#x25cb;</> : <>&#x25cf;</>
            }
          </button>
          <button disabled={!isRecordingAllowed} onClick={toggleRecordingMonitoringMute}>
            {isRecordingMonitoringMuted ? <b>M</b> : "M" }
          </button>
          <input
            type="range"
            disabled={!isRecordingAllowed}
            min={0}
            max={1}
            step={0.05}
            defaultValue={defaultRecordingMonitoringGain}
            onChange={changeRecordingMonitoringGain}
          />
          <button
            disabled={!isRecordingAllowed || isRecording || isRecordingWaiting}
            onClick={toggleRecordingWaitEnable}
          >
            {isRecordingWaitEnabled ? <b>&#x23f1;</b> : <>&#x23f1;</>}
          </button>
          <div>
            <h5>{translate("audio-looper:text.rsl")}</h5>
            <input
              type="number"
              disabled={!isRecordingAllowed || isRecording}
              min={-40}
              max={-6}
              step={1}
              value={recordingSilenceLevel}
              onChange={changeRecordingSilenceLevel}
              onKeyDown={(event) => event.preventDefault()}
            />
          </div>
        </div>
        <div>
          <button
            disabled={!isRecordingAllowed || isRecording || isRecordingWaiting}
            onClick={toggleMetronomeEnable}
          >
            {isMetronomeEnabled ? <>&#x1f50a;</> : <>&#x1f508;</>}
          </button>
          <input
            type="range"
            disabled={!isRecordingAllowed}
            min={0}
            max={1}
            step={0.05}
            defaultValue={defaultMetronomeGain}
            onChange={changeMetronomeGain}
          />
        </div>
      </div>
    </div>
  );
}
