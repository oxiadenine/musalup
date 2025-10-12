class LooperWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const { processorOptions } = options;

    this.channelCount = options.outputChannelCount[0];

    this.recordingDuration = processorOptions.recordingDuration;
    this.recordingGain = processorOptions.recordingGain;
    this.isRecordingMonitoringMuted = processorOptions.isRecordingMonitoringMuted;
    this.isRecordingWaitEnabled = processorOptions.isRecordingWaitEnabled ?? false;
    this.recordingSilenceLevel = processorOptions.recordingSilenceLevel;
    this.beatsPerMinute = processorOptions.beatsPerMinute;
    this.isMetronomeEnabled = processorOptions.isMetronomeEnabled ?? false;

    this.isRecordingSilence = this.isRecordingWaitEnabled ? true : false;

    this.framesPerBeat = Math.ceil(60 / this.beatsPerMinute * sampleRate);
    this.framesPerSubBeat = sampleRate / 30;

    this.currentBeat = 0;
    this.currentSubBeat = 0;

    this.currentMetronomeFrame = 0;
    this.currentMetronomeBeat = 0;
    this.metronomeDeviationToleranceFrames = Math.ceil(0.15 * sampleRate);

    this.isRecording = false;
    this.isPlaying = false;

    this.recordingFrameCount = 0;
    this.currentRecordingFrame = 0;
    this.recordingData = [];

    this.loopFrameCount = 0;
    this.currentLoopFrame = 0;
    this.loopLayers = [];

    this.compressionThreshold = Math.pow(10, -2 / 20); // -2 dBFS
    this.compressionLimit = 0.95;

    this.port.onmessage = ({ data }) => {
      if (data.type === "recording-start") {
        this.startRecording();
      } else if (data.type === "recording-wait") {
        this.waitRecording();
      } else if (data.type === "recording-stop") {
        this.stopRecording();
      } else if (data.type === "recording-gain-change") {
        this.recordingGain = data.recordingGain;
      } else if (data.type === "recording-monitoring-mute") {
        this.isRecordingMonitoringMuted = data.isRecordingMonitoringMuted;
      } else if (data.type === "recording-wait-enable") {
        this.isRecordingWaitEnabled = data.isRecordingWaitEnabled;

        this.isRecordingSilence = this.isRecordingWaitEnabled ? true : false;
      } else if (data.type === "recording-silence-level-change") {
        this.recordingSilenceLevel = data.recordingSilenceLevel;
      } else if (data.type === "loop-bpm-change") {
        this.beatsPerMinute = Math.max(30, Math.min(300, data.beatsPerMinute));

        this.framesPerBeat = Math.ceil((60 / this.beatsPerMinute) * sampleRate);
      } else if (data.type === "loop-start") {
        this.startLoop();
      } else if (data.type === "loop-stop") {
        this.stopLoop();
      } else if (data.type === "loop-clear") {
        this.clearLoop();
      } else if (data.type === "loop-layer-remove") {
        this.removeLastLoopLayer();
      } else if (data.type === "metronome-enable") {
        this.isMetronomeEnabled = data.isMetronomeEnabled;
      }
    }
  }

  startRecording() {
    this.isRecording = true;

    if (this.isMetronomeEnabled) {
      this.port.postMessage({ type: "metronome-click"});
    }
        
    if (this.loopLayers.length === 0) {
      this.recordingFrameCount = Math.ceil(this.recordingDuration * sampleRate);

      this.recordingData = new Array(this.channelCount)
        .fill(new Float32Array(this.recordingFrameCount));

      this.port.postMessage({ type: "loop-beat-update", loopBeat: 1 });
    } else {
      this.isRecordingSilence = true;

      this.recordingData = new Array(this.channelCount)
        .fill(new Float32Array(this.loopFrameCount));
    }

    this.port.postMessage({ type: "recording-start" });

    if (!this.isPlaying && this.loopLayers.length > 0) {
      this.isPlaying = true;

      this.port.postMessage({ type: "loop-start" });
      this.port.postMessage({ type: "loop-beat-update", loopBeat: 1 });
    }
  }

  waitRecording() {
    this.isRecording = true;

    this.isRecordingSilence = true;

    if (this.isMetronomeEnabled) {
      this.port.postMessage({ type: "metronome-click"});
    }
        
    if (this.loopLayers.length === 0) {
      this.recordingFrameCount = Math.ceil(this.recordingDuration * sampleRate);

      this.recordingData = new Array(this.channelCount)
        .fill(new Float32Array(this.recordingFrameCount));
    } else {
      this.recordingData = new Array(this.channelCount)
        .fill(new Float32Array(this.loopFrameCount));
    }

    if (this.isPlaying) {
      this.port.postMessage({ type: "recording-start" });
    } else {
      this.port.postMessage({ type: "recording-wait" });
    }
  }

  stopRecording() {
    this.isRecording = false;

    if (this.isMetronomeEnabled) {
      this.currentMetronomeFrame = 0;
      this.currentMetronomeBeat = 0;
    }

    if (!this.isRecordingSilence) {
      if (this.loopLayers.length === 0) {
        this.isMetronomeEnabled = false;

        this.recordingFrameCount = this.currentRecordingFrame;

        const recordedData = new Array(this.channelCount);

        for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
          recordedData[channelIndex] = this.recordingData[channelIndex].slice(0, this.recordingFrameCount);
        }

        this.loopLayers.push({ gain: this.recordingGain, data: recordedData });

        this.loopFrameCount = this.recordingFrameCount;

        this.currentBeat = 0;

        this.port.postMessage({
          type: "recording-stop",
          loopDuration: this.loopFrameCount,
          loopBeatCount: Math.ceil(this.loopFrameCount / this.framesPerBeat)
        });

        this.isPlaying = true;

        this.port.postMessage({ type: "loop-start" });
        this.port.postMessage({ type: "loop-beat-update", loopBeat: 1 });
      } else {
        this.loopLayers.push({ gain: this.recordingGain, data: this.recordingData });

        this.recordingData = new Array(this.channelCount)
          .fill(new Float32Array(this.loopFrameCount));
      }

      this.port.postMessage({
        type: "loop-layer-add",
        loopLayerCount: this.loopLayers.length
      });
    }

    this.isRecordingSilence = this.isRecordingWaitEnabled ? true : false;

    this.port.postMessage({ type: "recording-stop" });

    this.recordingData = [];
    this.currentRecordingFrame = 0;
  }

  startLoop() {
    this.isPlaying = true;

    this.port.postMessage({ type: "loop-start" });
    this.port.postMessage({ type: "loop-beat-update", loopBeat: 1 });
  }

  stopLoop() {
    this.isPlaying = false;
    this.currentLoopFrame = 0;

    this.currentBeat = 0;
    this.currentSubBeat = 0;

    this.port.postMessage({ type: "loop-stop" });
    this.port.postMessage({ type: "loop-beat-update", loopBeat: 1 });
  }

  clearLoop() {
    this.recordingFrameCount = Math.ceil(this.recordingDuration * sampleRate);
    
    this.loopFrameCount = 0;
    this.loopLayers = [];

    this.port.postMessage({ type: "loop-clear" });

    this.isMetronomeEnabled = true;

    this.port.postMessage({ type: "loop-beat-update", loopBeat: this.currentBeat });
  }

  removeLastLoopLayer() {
    this.loopLayers.pop();

    this.port.postMessage({
      type: "loop-layer-remove",
      loopLayerCount: this.loopLayers.length
    });
  }

  sendLoopBeat() {
    this.port.postMessage({ type: "loop-beat-update", loopBeat: this.currentBeat + 1 });
  }

  sendLoopTime() {
    this.port.postMessage({ type: "loop-time-update", loopTime: this.currentLoopFrame });
  }

  notifyMetronomeClick() {
    this.port.postMessage({ type: "metronome-click" });
  }

  process(inputs, outputs) {
    const recordingInput = inputs[0];
    const recordingOutput = outputs[0];

    const loopOutput = outputs[1];

    const channelCount = Math.min(recordingInput.length, this.channelCount);
    const frameBufferSize = recordingOutput[0].length;

    const isInputMono = channelCount === 1;

    if (this.isRecording && !this.isRecordingMonitoringMuted) {
      for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
        const channel = isInputMono ? recordingInput[0] : recordingInput[channelIndex];

        recordingOutput[channelIndex].set(channel);
      }
    }

    if (this.isRecording) {
      if (this.isMetronomeEnabled) {
        this.currentMetronomeFrame += frameBufferSize;

        const currentBeat = Math.floor(this.currentMetronomeFrame / this.framesPerBeat);

        if (currentBeat !== this.currentMetronomeBeat) {
          this.currentMetronomeBeat = currentBeat;

          this.notifyMetronomeClick();
        }
      }

      if (this.isRecordingSilence) {
        let recordingInputLoudness = 0;

        for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
          const channel = isInputMono ? recordingInput[0] : recordingInput[channelIndex];

          let recordingSampleSquareSum = 0;

          for (let sampleIndex = 0; sampleIndex < channel.length; sampleIndex++) {
            recordingSampleSquareSum += channel[sampleIndex] * channel[sampleIndex];
          }

          recordingInputLoudness += recordingSampleSquareSum;
        }

        recordingInputLoudness = Math.sqrt(recordingInputLoudness / (this.channelCount * frameBufferSize));

        if (recordingInputLoudness * this.recordingGain > this.recordingSilenceLevel) {
          this.isRecordingSilence = false;

          if (!this.isPlaying) {
            if (this.isMetronomeEnabled) {
              const lastBeatFrame = Math.floor(this.currentMetronomeBeat * this.framesPerBeat);
              const deviationFrames = this.currentMetronomeFrame - lastBeatFrame;

              if (deviationFrames > this.metronomeDeviationToleranceFrames) {
                this.currentMetronomeFrame = 0;
                this.currentMetronomeBeat = 0;

                this.notifyMetronomeClick();
              }
            }

            this.port.postMessage({ type: "recording-start" });

            if (this.loopLayers.length === 0) {
              this.port.postMessage({ type: "loop-beat-update", loopBeat: this.currentBeat + 1 });
            } else {
              this.startLoop();
            }
          }
        }
      }

      if (!this.isRecordingSilence) {
        for (let sampleIndex = 0; sampleIndex < frameBufferSize; sampleIndex++) {
          for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
            const channel = isInputMono ? recordingInput[0] : recordingInput[channelIndex];

            const recordingSampleIndex = this.loopLayers.length === 0
              ? sampleIndex + this.currentRecordingFrame
              : sampleIndex + this.currentLoopFrame;

            this.recordingData[channelIndex][recordingSampleIndex] = channel[sampleIndex];
          }
        }

        if (this.loopLayers.length === 0) {
          this.currentRecordingFrame += frameBufferSize;
        }
      }
    }

    if (this.isPlaying) {
      for (let sampleIndex = 0; sampleIndex < frameBufferSize; sampleIndex++) {
        const loopSampleIndex = sampleIndex + this.currentLoopFrame;

        for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
          let mixedLoopSample = 0;

          for (const loopLayer of this.loopLayers) {
            mixedLoopSample += loopLayer.data[channelIndex][loopSampleIndex] * loopLayer.gain;
          }

          const absoluteMixedLoopSample = Math.abs(mixedLoopSample);
          
          let loopSample = 0;

          if (absoluteMixedLoopSample <= this.compressionThreshold) {
            loopSample = mixedLoopSample;
          } else {
            const scaledLoopSample = (absoluteMixedLoopSample - this.compressionThreshold) / (1 - this.compressionThreshold);
            const clippedLoopSample = Math.tanh(scaledLoopSample);
            const compressedLoopSample = this.compressionThreshold + clippedLoopSample * (1 - this.compressionThreshold);

            loopSample = Math.sign(mixedLoopSample) * Math.min(compressedLoopSample, this.compressionLimit);
          }

          loopOutput[channelIndex][sampleIndex] = loopSample;
        }
      }

      this.currentLoopFrame += frameBufferSize;
    }

    if (this.isRecording || this.isPlaying) {
      if (this.isPlaying) {
        const currentBeat = Math.floor(this.currentLoopFrame / this.framesPerBeat);

        if (currentBeat !== this.currentBeat) {
          this.currentBeat = currentBeat;
          
          this.sendLoopBeat();
        }

        const currentSubBeat = Math.floor(this.currentLoopFrame / this.framesPerSubBeat);

        if (currentSubBeat !== this.currentSubBeat) {
          this.currentSubBeat = currentSubBeat;

          this.sendLoopTime();
        }
      } else {
        if (!this.isRecordingSilence) {
          const currentBeat = Math.floor(this.currentRecordingFrame / this.framesPerBeat);

          if (currentBeat !== this.currentBeat) {
            this.currentBeat = currentBeat;
          
            this.sendLoopBeat();
          }
        }
      }
    }

    if (this.isRecording && this.loopLayers.length === 0) {
      if (this.currentRecordingFrame === this.recordingFrameCount) {
        this.stopRecording();
      }
    }

    if (this.isPlaying && this.loopLayers.length > 0) {
      if (this.currentLoopFrame === this.loopFrameCount) {
        if (this.isRecording) {
          if (!this.isRecordingSilence) {
            this.loopLayers.push({ gain: this.recordingGain, data: this.recordingData });

            this.recordingData = new Array(this.channelCount)
              .fill(new Float32Array(this.loopFrameCount));

            this.port.postMessage({
              type: "loop-layer-add",
              loopLayerCount: this.loopLayers.length
            });
          }

          this.isRecordingSilence = true;
        }

        this.sendLoopTime();
        
        this.currentLoopFrame = 0;

        this.currentBeat = 0;
        this.currentSubBeat = 0;

        this.sendLoopBeat();
        this.sendLoopTime();
      }
    }

    return true;
  }
}

registerProcessor("looper-worklet", LooperWorkletProcessor);
