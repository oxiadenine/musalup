import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../lib/intl.js";
import { getInputStream } from "../../lib/audio/audio-devices";
import "./audio-looper.css";
import looperWorkletFile from "../../lib/audio/audio-looper-worklet.js" with { type: "file" };

const messages = {
  es: {
    text: {
      recording: "Grabando",
      playing: "Reproduciendo"
    }
  },
  en: {
    text: {
      recording: "Recording",
      playing: "Playing"
    }
  }
};

export function AudioLooper() {
  const [translate] = useTranslation("audio-looper", messages);

  const inputStreamRef = useRef(undefined);
  const audioContextRef = useRef(undefined);
  const inputStreamSourceNodeRef = useRef(undefined);
  const looperWorkletNodeRef = useRef(undefined);
  const inputGainNodeRef = useRef(undefined);
  const metronomeGainNodeRef = useRef(undefined);

  const defaultSampleRate = 48000;
  const defaultBeatsPerMinute = 120;
  const defaultRecordingDuration = 300;
  const defaultRecordingGain = 0.8;
  const defaultMetronomeGain = 0.8;

  const [isRecordingAllowed, setIsRecordingAllowed] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isRecordingMuted, setIsRecordingMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  const [loopDuration, setLoopDuration] = useState(0);
  const [loopBeatCount, setLoopBeatCount] = useState(0);
  const [loopLayerCount, setLoopLayerCount] = useState(0);
  const [loopTime, setLoopTime] = useState(0);
  const [loopBeat, setLoopBeat] = useState(0);

  const [beatsPerMinute, setBeatsPerMinute] = useState(defaultBeatsPerMinute);
  const [isMetronomeEnabled, setIsMetronomeEnabled] = useState(true);

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
        numberOfOutputs: [2],
        outputChannelCount: [channelCount, channelCount],
        processorOptions: {
          recordingDuration: defaultRecordingDuration,
          isRecordingMuted,
          beatsPerMinute,
          isMetronomeEnabled
        }
      }
    );

    looperWorkletNodeRef.current.port.onmessage = ({ data }) => {
      if (data.type === "recording-start") {
        setIsRecording(true);
      } else if (data.type === "recording-stop") {
        setIsRecording(false);

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
        setIsMetronomeEnabled(true);
      } else if (data.type === "loop-layer-add") {
        setLoopLayerCount(data.loopLayerCount);
      } else if (data.type === "loop-layer-remove") {
        setLoopLayerCount(data.loopLayerCount);
      } else if (data.type === "loop-beat-update") {
        setLoopBeat(data.loopBeat);
      } else if (data.type === "loop-time-update") {
        setLoopTime(data.loopTime);
      } else if (data.type === "metronome-click") {
        playMetronomeClick();
      }
    };

    inputGainNodeRef.current = new GainNode(audioContextRef.current, {
      channelCount,
      gain: defaultRecordingGain
    });

    metronomeGainNodeRef.current = new GainNode(audioContextRef.current, {
      channelCount,
      gain: defaultMetronomeGain
    });

    inputStreamSourceNodeRef.current.connect(looperWorkletNodeRef.current);
    looperWorkletNodeRef.current.connect(inputGainNodeRef.current, 0, 0);
    looperWorkletNodeRef.current.connect(audioContextRef.current.destination, 1, 0);
    inputGainNodeRef.current.connect(audioContextRef.current.destination);
    metronomeGainNodeRef.current.connect(audioContextRef.current.destination);

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

    if (inputGainNodeRef.current) {
      inputGainNodeRef.current.disconnect();
    }

    if (metronomeGainNodeRef.current) {
      metronomeGainNodeRef.current.disconnect();
    }
    
    if (audioContextRef.current) {
      await audioContextRef.current.close();
    }
  }

  function startRecording() {
    looperWorkletNodeRef.current.port.postMessage({ type: "recording-start" });
  }

  function stopRecording() {
    looperWorkletNodeRef.current.port.postMessage({ type: "recording-stop" });
  }

  function toggleRecordingMute() {
    looperWorkletNodeRef.current.port.postMessage({
      type: "recording-mute",
      isRecordingMuted: !isRecordingMuted
    });

    setIsRecordingMuted(!isRecordingMuted);
  }

  function changeRecordingGain(event) {
    const gain = event.target.value;

    inputGainNodeRef.current.gain.setValueAtTime(gain, audioContextRef.current.currentTime);
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

  function removeLastLoopLayer() {
    looperWorkletNodeRef.current.port.postMessage({ type: "loop-layer-remove" });
  }

  function changeBeatsPerMinute(event) {
    const beatsPerMinute = event.target.value;

    looperWorkletNodeRef.current.port.postMessage({
      type: "loop-bpm-change",
      beatsPerMinute
    });

    setBeatsPerMinute(beatsPerMinute);
  }

  function toggleIsMetronomeEnabled() {
    looperWorkletNodeRef.current.port.postMessage({
      type: "metronome-enable",
      isMetronomeEnabled: !isMetronomeEnabled
    });

    setIsMetronomeEnabled(!isMetronomeEnabled);
  }

  function changeMetronomeGain(event) {
    const gain = event.target.value;

    metronomeGainNodeRef.current.gain.setValueAtTime(gain, audioContextRef.current.currentTime);
  }

  function playMetronomeClick() {
    const gainNode = new GainNode(audioContextRef.current);
    const oscillatorNode = new OscillatorNode(audioContextRef.current, { frequency: 1000 });
      
    oscillatorNode.connect(gainNode);
    gainNode.connect(metronomeGainNodeRef.current);
      
    const currentTime = audioContextRef.current.currentTime;
  
    const attackTime = 0.005;
    const decayTime = 0.05;
    const sustainLevel = 0.5;
    const releaseTime = 0.05;
  
    const clickDuration = attackTime + decayTime + releaseTime;
  
    gainNode.gain.setValueAtTime(0, currentTime);
    gainNode.gain.exponentialRampToValueAtTime(1, currentTime + attackTime);
    gainNode.gain.exponentialRampToValueAtTime(sustainLevel, currentTime + attackTime + decayTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, currentTime + attackTime + decayTime + releaseTime);
  
    oscillatorNode.start(currentTime);
    oscillatorNode.stop(currentTime + clickDuration);
  }

  useEffect(() => {
    initializeAudio();

    return () => {
      freeAudioResources();
    };
  }, []);

  return (
    <div className="audio-looper">
      <div>
        <h3>Looper</h3>
        <h5>
          {isRecording && translate("audio-looper:text.recording")}
          {isPlaying && !isRecording && translate("audio-looper:text.playing")}
        </h5>
      </div>
      <div>
        {loopDuration > 0 && (
          <button
            disabled={!isRecordingAllowed || isRecording}
            onClick={!isPlaying ? startLoop : stopLoop}
          >
            {!isPlaying ? <>&#x25b6;</> : <>&#x25a9;</>}
          </button>
        )}
        <progress max={loopDuration} value={loopTime} />
        {isRecording && loopDuration === 0 && <h5>{loopBeat}</h5>}
        {loopDuration > 0 && <h5>{`${loopBeat}/${loopBeatCount} (${loopLayerCount})`}</h5>}
      </div>
      <div>
        {loopDuration > 0 && (
          <div>
            <button
              disabled={!isRecordingAllowed || isRecording || isPlaying}
              onClick={clearLoop}
            >
              &#x267b;
            </button>
            <button
              disabled={!isRecordingAllowed || isRecording || isPlaying || loopLayerCount < 2}
              onClick={removeLastLoopLayer}
            >
              &#x2baa;
            </button>
          </div>
        )}
        <div>
          <button
            disabled={!isRecordingAllowed}
            onClick={!isRecording ? startRecording : stopRecording}
          >
            {!isRecording ? <>&#x25cb;</> : <>&#x25cf;</>}
          </button>
          <button disabled={!isRecordingAllowed} onClick={toggleRecordingMute}>
            {isRecordingMuted ? <b>M</b> : "M" }
          </button>
          <input
            type="range"
            disabled={!isRecordingAllowed}
            min="0"
            max="1"
            step="0.01"
            defaultValue={defaultRecordingGain}
            onChange={changeRecordingGain}
          />
        </div>
        <div>
          <div>
            <h5>Tempo</h5>
            <input
              type="number"
              disabled={!isRecordingAllowed || isRecording || loopDuration > 0}
              min={30} max={300}
              value={beatsPerMinute}
              onChange={changeBeatsPerMinute}
              onKeyDown={(event) => event.preventDefault()}
            />
          </div>
          <button
            disabled={!isRecordingAllowed}
            onClick={toggleIsMetronomeEnabled}
          >
            {isMetronomeEnabled ? <>&#x1f50a;</> : <>&#x1f508;</>}
          </button>
          <input
            type="range"
            disabled={!isRecordingAllowed}
            min="0"
            max="1"
            step="0.01"
            defaultValue={defaultMetronomeGain}
            onChange={changeMetronomeGain}
          />
        </div>
      </div>
    </div>
  );
}
