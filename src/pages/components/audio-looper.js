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

export function createAudioLooper(element, options = {}) {
  let language = options.intl.language;

  const translate = (key) => {
    let value = messages[language];

    if (!value) {
      return key;
    }

    if (typeof value === "string") {
      return value;
    }

    const keyParts = key.split(".");

    for (let index = 0; index < keyParts.length; index++) {
      if (value.hasOwnProperty(keyParts[index])) {
        value = value[keyParts[index]];
      } else {
        return key;
      }
    }

    return value;
  };

  let inputStream = undefined;
  let audioContext = undefined;
  let inputStreamSourceNode = undefined;
  let looperWorkletNode = undefined;

  const defaultSampleRate = 48000;
  const defaultRecordingDuration = 300;
  const defaultRecordingMonitoringGain = 0.8;
  const defaultRecordingSilenceLevel = -32; // dBFS
  const defaultLoopGain = Math.pow(10, -4 / 20); // -4 dBFS
  const defaultLoopBeatsPerMinute = 120;
  const defaultMetronomeGain = 0.8;

  let isRecordingAllowed = false;
  let isRecording = false;
  let isRecordingWaiting = false;
  let isPlaying = false;

  let isRecordingMonitoringMuted = true;
  let recordingMonitoringGain = defaultRecordingMonitoringGain;
  let isRecordingWaitEnabled = true;
  let recordingSilenceLevel = defaultRecordingSilenceLevel;

  let loopGain = defaultLoopGain;
  let loopBeatsPerMinute = defaultLoopBeatsPerMinute;

  let loopLayerCount = 0;
  let loopDuration = 0;
  let loopBeatCount = 0;
  let loopTime = 0;
  let loopBeat = 0;

  let isMetronomeEnabled = true;
  let metronomeGain = defaultMetronomeGain;

  const dom = {};

  function createDom() {
    dom.textLoopStatus = element.querySelector("#text-loop-status");
    dom.buttonLoop = element.querySelector("#button-loop");
    dom.progressLoopTime = element.querySelector("#progress-loop-time");
    dom.textLoopBeat = element.querySelector("#text-loop-beat");
    dom.containerLoopLayer = element.querySelector("#container-loop-layer");
    dom.buttonLoopLayerRemove = element.querySelector("#button-loop-layer-remove");
    dom.textLoopLayerCount = element.querySelector("#text-loop-layer-count");
    dom.buttonLoopClear = element.querySelector("#button-loop-clear");
    dom.inputLoopGain = element.querySelector("#input-loop-gain");
    dom.textLoopBpm = element.querySelector("#text-loop-bpm");
    dom.inputLoopBpm = element.querySelector("#input-loop-bpm");
    dom.buttonRecording = element.querySelector("#button-recording");
    dom.buttonRecordingMonitoringMute = element.querySelector("#button-recording-monitoring-mute");
    dom.inputRecordingMonitoringGain = element.querySelector("#input-recording-monitoring-gain");
    dom.buttonRecordingWaitEnable = element.querySelector("#button-recording-wait-enable");
    dom.textRecordingRsl = element.querySelector("#text-recording-rsl");
    dom.inputRecordingRsl = element.querySelector("#input-recording-rsl");
    dom.buttonMetronomeEnable = element.querySelector("#button-metronome-enable");
    dom.inputMetronomeGain = element.querySelector("#input-metronome-gain");
  }

  function createHtml() {
    element.innerHTML = `
      <div class="audio-looper">
        <div>
          <h3>Looper</h3>
          <h5 id="text-loop-status"></h5>
        </div>
        <div>
          <button id="button-loop" style="display: none"></button>
          <progress id="progress-loop-time" max="${loopDuration}" value="${loopTime}"></progress>
          <h5 id="text-loop-beat" style="display: none"></h5>
        </div>
        <div>
          <div id="container-loop-layer" style="display: none">
            <button id="button-loop-layer-remove">&#x2baa;</button>
            <h5 id="text-loop-layer-count">${loopLayerCount}</h5>
            <button id="button-loop-clear">&#x267b;</button>
          </div>
        </div>
        <div>
          <div>
            <input id="input-loop-gain" type="range" min="0.1" max="1" step="0.01" value="${loopGain}" />
            <div>
              <h5 id="text-loop-bpm">${translate("text.bpm")}</h5>
              <input id="input-loop-bpm" type="number" min="30" max="300" value="${loopBeatsPerMinute}" />
            </div>
          </div>
          <div>
            <button id="button-recording"></button>
            <button id="button-recording-monitoring-mute"></button>
            <input id="input-recording-monitoring-gain" type="range" min="0" max="1" step="0.05" value="${recordingMonitoringGain}" />
            <button id="button-recording-wait-enable"></button>
            <div>
              <h5 id="text-recording-rsl">${translate("text.rsl")}</h5>
              <input id="input-recording-rsl" type="number" min="-40" max="-6" step="1" value="${recordingSilenceLevel}" />
            </div>
          </div>
          <div>
            <button id="button-metronome-enable"></button>
            <input id="input-metronome-gain" type="range" min="0" max="1" step="0.05" value="${metronomeGain}" />
          </div>
        </div>
      </div>
    `;
  }

  function attachEventListeners() {
    dom.buttonRecording.addEventListener("click", () => {
      if (isRecordingWaitEnabled) {
        if (!isRecording && !isRecordingWaiting) {
          waitRecording();
        } else {
          stopRecording();
        }
      } else {
        if (!isRecording) {
          startRecording();
        } else {
          stopRecording();
        }
      }
    });

    dom.buttonRecordingMonitoringMute.addEventListener("click", toggleRecordingMonitoringMute);
    dom.inputRecordingMonitoringGain.addEventListener("input", changeRecordingMonitoringGain);
    dom.buttonRecordingWaitEnable.addEventListener("click", toggleRecordingWaitEnable);
    dom.inputRecordingRsl.addEventListener("input", changeRecordingSilenceLevel);
    
    dom.buttonLoop.addEventListener("click", () => {
      if (!isPlaying) {
        startLoop();
      } else {
        stopLoop();
      }
    });

    dom.buttonLoopLayerRemove.addEventListener("click", removeLoopLayer);
    dom.buttonLoopClear.addEventListener("click", clearLoop);
    
    dom.inputLoopGain.addEventListener("input", changeLoopGain);
    dom.inputLoopBpm.addEventListener("input", changeLoopBeatsPerMinute);
    
    dom.buttonMetronomeEnable.addEventListener("click", toggleMetronomeEnable);
    dom.inputMetronomeGain.addEventListener("input", changeMetronomeGain);
    
    document.addEventListener("keydown", handleKeyEvent);
  }

  function removeEventListeners() {
    document.removeEventListener("keydown", handleKeyEvent);
  }

  function render() {
    dom.textLoopStatus.textContent = isRecording && !isRecordingWaiting ? translate("text.recording") :
      (!isRecording && isRecordingWaiting ? translate("text.waiting") :
      (!isRecording && !isRecordingWaiting && isPlaying ? translate("text.playing") : ""));

    if (loopLayerCount > 0) {
      dom.buttonLoop.style.display = "";
      dom.buttonLoop.disabled = !isRecordingAllowed || isRecording || isRecordingWaiting;
      dom.buttonLoop.innerHTML = !isPlaying ? "&#x25b6;" : "&#x25a9;";
    } else {
      dom.buttonLoop.style.display = "none";
    }

    dom.progressLoopTime.max = loopDuration;
    dom.progressLoopTime.value = loopTime;

    if (isRecording && loopDuration === 0) {
      dom.textLoopBeat.style.display = "";
      dom.textLoopBeat.textContent = loopBeat;
    } else if (loopDuration > 0) {
      dom.textLoopBeat.textContent = `${loopBeat}/${loopBeatCount}`;
    } else {
      dom.textLoopBeat.style.display = "none";
      dom.textLoopBeat.textContent = "";
    }

    if (loopDuration > 0) {
      dom.containerLoopLayer.style.display = "";
      dom.buttonLoopLayerRemove.disabled = !isRecordingAllowed || isRecording || isRecordingWaiting || isPlaying || loopLayerCount <= 1;
      dom.textLoopLayerCount.textContent = loopLayerCount;
      dom.buttonLoopClear.disabled = !isRecordingAllowed || isRecording || isRecordingWaiting || isPlaying;
    } else {
      dom.containerLoopLayer.style.display = "none";
    }

    dom.inputLoopGain.disabled = !isRecordingAllowed || isRecording || isRecordingWaiting;
    dom.inputLoopGain.value = loopGain;

    dom.textLoopBpm.textContent = translate("text.bpm");
    dom.inputLoopBpm.disabled = !isRecordingAllowed || isRecording || isRecordingWaiting || loopDuration > 0;
    dom.inputLoopBpm.value = loopBeatsPerMinute;

    dom.buttonRecording.disabled = !isRecordingAllowed;
    dom.buttonRecording.innerHTML = isRecordingWaitEnabled
      ? (!isRecording && !isRecordingWaiting ? "&#x25cb;" : "&#x25cf;")
      : (!isRecording ? "&#x25cb;" : "&#x25cf;");

    dom.buttonRecordingMonitoringMute.disabled = !isRecordingAllowed;
    dom.buttonRecordingMonitoringMute.innerHTML = isRecordingMonitoringMuted ? "<b>M</b>" : "M";

    dom.inputRecordingMonitoringGain.disabled = !isRecordingAllowed;
    dom.inputRecordingMonitoringGain.value = recordingMonitoringGain;

    dom.buttonRecordingWaitEnable.disabled = !isRecordingAllowed || isRecording || isRecordingWaiting;
    dom.buttonRecordingWaitEnable.innerHTML = isRecordingWaitEnabled ? "<b>&#x23f1;</b>" : "&#x23f1;";

    dom.textRecordingRsl.textContent = translate("text.rsl");
    dom.inputRecordingRsl.disabled = !isRecordingAllowed || isRecording;
    dom.inputRecordingRsl.value = recordingSilenceLevel;

    dom.buttonMetronomeEnable.disabled = !isRecordingAllowed || isRecording || isRecordingWaiting;
    dom.buttonMetronomeEnable.innerHTML = isMetronomeEnabled ? "&#x1f50a;" : "&#x1f508;";

    dom.inputMetronomeGain.disabled = !isRecordingAllowed;
    dom.inputMetronomeGain.value = metronomeGain;
  }

  async function initializeAudio() {
    inputStream = await getInputStream();

    if (!inputStream) {
      isRecordingAllowed = false;

      render();

      return;
    }

    const audioTracks = inputStream.getAudioTracks();
    const audioTrackSettings = audioTracks[0].getSettings();
    const channelCount = audioTrackSettings.channelCount;
    const sampleRate = audioTrackSettings.sampleRate ?? defaultSampleRate;

    audioContext = new AudioContext({ sampleRate: sampleRate, latencyHint: "interactive" });

    inputStreamSourceNode = audioContext.createMediaStreamSource(inputStream);

    await audioContext.audioWorklet.addModule(looperWorkletFile);

    looperWorkletNode = new AudioWorkletNode(
      audioContext,
      "looper-worklet",
      {
        numberOfOutputs: [3],
        outputChannelCount: [channelCount, channelCount, channelCount],
        processorOptions: {
          recordingDuration: defaultRecordingDuration,
          isRecordingMonitoringMuted: isRecordingMonitoringMuted,
          recordingMonitoringGain: recordingMonitoringGain,
          isRecordingWaitEnabled: isRecordingWaitEnabled,
          recordingSilenceLevel: Math.pow(10, defaultRecordingSilenceLevel / 20),
          loopGain: loopGain,
          loopBeatsPerMinute: loopBeatsPerMinute,
          isMetronomeEnabled: isMetronomeEnabled,
          metronomeGain: metronomeGain
        }
      }
    );

    looperWorkletNode.port.onmessage = (event) => {
      const data = event.data;

      if (data.type === "recording-start") {
        isRecording = true;
        isRecordingWaiting = false;

        render();
      } else if (data.type === "recording-wait") {
        isRecordingWaiting = true;

        render();
      } else if (data.type === "recording-stop") {
        isRecording = false;
        isRecordingWaiting = false;

        if (data.loopDuration) {
          loopDuration = data.loopDuration;
          loopBeatCount = data.loopBeatCount;
          isMetronomeEnabled = false;
        }

        render();
      } else if (data.type === "loop-start") {
        isPlaying = true;

        render();
      } else if (data.type === "loop-stop") {
        isPlaying = false;
        loopTime = 0;
        loopBeat = 0;

        render();
      } else if (data.type === "loop-clear") {
        loopDuration = 0;
        loopBeatCount = 0;
        loopLayerCount = 0;
        isMetronomeEnabled = true;

        render();
      } else if (data.type === "loop-layer-add") {
        loopLayerCount = data.loopLayerCount;

        render();
      } else if (data.type === "loop-layer-remove") {
        loopLayerCount = data.loopLayerCount;

        render();
      } else if (data.type === "loop-beat-update") {
        loopBeat = data.loopBeat;

        if (loopDuration > 0) {
          dom.textLoopBeat.textContent = `${loopBeat}/${loopBeatCount}`;
        } else {
          dom.textLoopBeat.textContent = loopBeat;
        }
      } else if (data.type === "loop-time-update") {
        loopTime = data.loopTime;

        dom.progressLoopTime.value = loopTime;
      }
    };

    inputStreamSourceNode.connect(looperWorkletNode);
    looperWorkletNode.connect(audioContext.destination, 0, 0);
    looperWorkletNode.connect(audioContext.destination, 1, 0);
    looperWorkletNode.connect(audioContext.destination, 2, 0);
    isRecordingAllowed = true;

    render();
  }

  async function freeAudioResources() {
    if (inputStream) {
      const audioTracks = inputStream.getAudioTracks();

      audioTracks.forEach((audioTrack) => audioTrack.stop());
    }

    if (inputStreamSourceNode) {
      inputStreamSourceNode.disconnect();
    }

    if (looperWorkletNode) {
      looperWorkletNode.disconnect();
    }

    if (audioContext) {
      await audioContext.close();
    }
  }

  function startRecording() {
    looperWorkletNode.port.postMessage({ type: "recording-start" });
  }

  function waitRecording() {
    looperWorkletNode.port.postMessage({ type: "recording-wait" });
  }

  function stopRecording() {
    looperWorkletNode.port.postMessage({ type: "recording-stop" });
  }

  function toggleRecordingMonitoringMute() {
    isRecordingMonitoringMuted = !isRecordingMonitoringMuted;

    looperWorkletNode.port.postMessage({
      type: "recording-monitoring-mute-enable",
      isRecordingMonitoringMuted
    });

    dom.buttonRecordingMonitoringMute.innerHTML = isRecordingMonitoringMuted ? "<b>M</b>" : "M";
  }

  function changeRecordingMonitoringGain(event) {
    recordingMonitoringGain = event.target.value;

    looperWorkletNode.port.postMessage({
      type: "recording-monitoring-gain-change",
      recordingMonitoringGain
    });

    dom.inputRecordingMonitoringGain.value = recordingMonitoringGain;
  }

  function toggleRecordingWaitEnable() {
    isRecordingWaitEnabled = !isRecordingWaitEnabled;

    looperWorkletNode.port.postMessage({
      type: "recording-wait-enable",
      isRecordingWaitEnabled
    });

    dom.buttonRecordingWaitEnable.innerHTML = isRecordingWaitEnabled ? "<b>&#x23f1;</b>" : "&#x23f1;";
  }

  function changeRecordingSilenceLevel(event) {
    recordingSilenceLevel = event.target.value;

    looperWorkletNode.port.postMessage({
      type: "recording-silence-level-change",
      recordingSilenceLevel: Math.pow(10, recordingSilenceLevel / 20)
    });

    dom.inputRecordingRsl.value = recordingSilenceLevel;
  }

  function changeLoopGain(event) {
    loopGain = event.target.value;

    looperWorkletNode.port.postMessage({
      type: "loop-gain-change",
      loopGain
    });

    dom.inputLoopGain.value = loopGain;
  }

  function changeLoopBeatsPerMinute(event) {
    loopBeatsPerMinute = event.target.value;

    looperWorkletNode.port.postMessage({
      type: "loop-bpm-change",
      loopBeatsPerMinute
    });

    dom.inputLoopBpm.value = loopBeatsPerMinute;
  }

  function startLoop() {
    looperWorkletNode.port.postMessage({ type: "loop-start" });
  }

  function stopLoop() {
    looperWorkletNode.port.postMessage({ type: "loop-stop" });
  }

  function clearLoop() {
    looperWorkletNode.port.postMessage({ type: "loop-clear" });
  }

  function removeLoopLayer() {
    looperWorkletNode.port.postMessage({ type: "loop-layer-remove" });
  }

  function toggleMetronomeEnable() {
    isMetronomeEnabled = !isMetronomeEnabled;

    looperWorkletNode.port.postMessage({
      type: "metronome-enable",
      isMetronomeEnabled
    });

    dom.buttonMetronomeEnable.innerHTML = isMetronomeEnabled ? "&#x1f50a;" : "&#x1f508;";
  }

  function changeMetronomeGain(event) {
    metronomeGain = event.target.value;

    looperWorkletNode.port.postMessage({
      type: "metronome-gain-change",
      metronomeGain
    });

    dom.inputMetronomeGain.value = metronomeGain;
  }

  function handleKeyEvent(event) {
    if (!isRecordingAllowed) {
      return;
    }

    if (event.code === "Space") {
      event.preventDefault();

      if (isRecordingWaitEnabled) {
        if (!isRecording && !isRecordingWaiting) {
          waitRecording();
        } else {
          stopRecording();
        }
      } else {
        if (!isRecording) {
          startRecording();
        } else {
          stopRecording();
        }
      }
    }

    if (isRecording || isRecordingWaiting || loopDuration === 0) {
      return;
    }

    if (event.code === "Enter") {
      event.preventDefault();

      if (isPlaying) {
        stopLoop();
      } else {
        startLoop();
      }
    } else if (event.code === "Backspace" && event.shiftKey) {
      event.preventDefault();

      if (!isPlaying) {
        clearLoop();
      }
    } else if (event.code === "Backspace") {
      event.preventDefault();

      if (!isPlaying && loopLayerCount > 1) {
        removeLoopLayer();
      }
    }
  }

  createHtml();
  createDom();
  attachEventListeners();

  options.intl.languageListener((newLanguage) => {
    language = newLanguage;

    render();
  });

  initializeAudio();

  return {
    destroy: () => {
      freeAudioResources();
      removeEventListeners();
    }
  };
}
