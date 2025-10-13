class LooperWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const { processorOptions } = options;

    this.channelCount = options.outputChannelCount[0];

    this.recordingDuration = processorOptions.recordingDuration;
    this.isRecordingMonitoringMuted = processorOptions.isRecordingMonitoringMuted;
    this.recordingMonitoringGain = processorOptions.recordingMonitoringGain;
    this.isRecordingWaitEnabled = processorOptions.isRecordingWaitEnabled ?? false;
    this.recordingSilenceLevel = processorOptions.recordingSilenceLevel;
    this.loopGain = processorOptions.loopGain;
    this.loopBeatsPerMinute = processorOptions.loopBeatsPerMinute;
    this.isMetronomeEnabled = processorOptions.isMetronomeEnabled ?? false;
    this.metronomeGain = processorOptions.metronomeGain;

    this.isRecordingSilence = this.isRecordingWaitEnabled ? true : false;

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

    this.framesPerBeat = Math.ceil(60 / this.loopBeatsPerMinute * sampleRate);
    this.framesPerSubBeat = sampleRate / 30;

    this.currentBeat = 0;
    this.currentSubBeat = 0;

    this.currentMetronomeFrame = 0;
    this.currentMetronomeBeat = 0;
    this.metronomeDeviationToleranceFrames = Math.ceil(0.15 * sampleRate);
    this.metronomeClickSampleCount = Math.ceil(0.1 * sampleRate);
    this.currentMetronomeClickSample = 0;
    this.metronomeClickSamples = this.createMetronomeClick();
    this.isMetronomeClickActive = false;

    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(event) {
    const data = event.data;

    if (data.type === "recording-start") {
      this.startRecording();
    } else if (data.type === "recording-wait") {
      this.waitRecording();
    } else if (data.type === "recording-stop") {
      this.stopRecording();
    } else if (data.type === "recording-monitoring-mute-enable") {
      this.isRecordingMonitoringMuted = data.isRecordingMonitoringMuted;
    } else if (data.type === "recording-monitoring-gain-change") {
      this.recordingMonitoringGain = data.recordingMonitoringGain;
    } else if (data.type === "recording-wait-enable") {
      this.isRecordingWaitEnabled = data.isRecordingWaitEnabled;

      this.isRecordingSilence = this.isRecordingWaitEnabled ? true : false;
    } else if (data.type === "recording-silence-level-change") {
      this.recordingSilenceLevel = data.recordingSilenceLevel;
    } else if (data.type === "loop-gain-change") {
      this.loopGain = data.loopGain;
    } else if (data.type === "loop-bpm-change") {
      this.loopBeatsPerMinute = Math.max(30, Math.min(300, data.loopBeatsPerMinute));

      this.framesPerBeat = Math.ceil((60 / this.loopBeatsPerMinute) * sampleRate);
    } else if (data.type === "loop-start") {
      this.startLoop();
    } else if (data.type === "loop-stop") {
      this.stopLoop();
    } else if (data.type === "loop-clear") {
      this.clearLoop();
    } else if (data.type === "loop-layer-remove") {
      this.removeLoopLayer();
    } else if (data.type === "metronome-enable") {
      this.isMetronomeEnabled = data.isMetronomeEnabled;
    } else if (data.type === "metronome-gain-change") {
      this.metronomeGain = data.metronomeGain;
    }
  }

  startRecording() {
    this.isRecording = true;

    if (this.isMetronomeEnabled) {
      this.isMetronomeClickActive = true;
    }
   
    if (this.loopLayers.length === 0) {
      this.recordingFrameCount = Math.ceil(this.recordingDuration * sampleRate);

      this.recordingData = new Array(this.channelCount)
        .fill(new Float32Array(this.recordingFrameCount));

      this.port.postMessage({ type: "recording-start" });
      this.port.postMessage({ type: "loop-beat-update", loopBeat: 1 });
    } else {
      this.recordingData = new Array(this.channelCount)
        .fill(new Float32Array(this.recordingFrameCount));

      this.isRecordingSilence = true;

      this.port.postMessage({ type: "recording-start" });

      if (!this.isPlaying) {
        this.startLoop();
      }
    }
  }

  waitRecording() {
    this.isRecording = true;

    this.isRecordingSilence = true;

    if (this.isMetronomeEnabled) {
      this.isMetronomeClickActive = true;
    }
        
    if (this.loopLayers.length === 0) {
      this.recordingFrameCount = Math.ceil(this.recordingDuration * sampleRate);

      this.recordingData = new Array(this.channelCount)
        .fill(new Float32Array(this.recordingFrameCount));

      this.port.postMessage({ type: "recording-wait" });
    } else {
      this.recordingData = new Array(this.channelCount)
        .fill(new Float32Array(this.recordingFrameCount));

      if (this.isPlaying) {
        this.port.postMessage({ type: "recording-start" });
      } else {
        this.port.postMessage({ type: "recording-wait" });
      }
    }
  }

  stopRecording() {
    this.isRecording = false;

    if (this.isMetronomeEnabled) {
      this.currentMetronomeFrame = 0;
      this.currentMetronomeBeat = 0;
      this.currentMetronomeClickSample = 0;
      this.isMetronomeClickActive = false;
    }

    if (!this.isRecordingSilence) {
      if (this.loopLayers.length === 0) {
        this.isMetronomeEnabled = false;

        this.recordingFrameCount = this.currentRecordingFrame;

        const recordedData = new Array(this.channelCount);

        for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
          recordedData[channelIndex] = this.recordingData[channelIndex].slice(0, this.recordingFrameCount);
        }

        this.currentRecordingFrame = 0;
        this.recordingData = [];

        this.loopLayers.push(recordedData);

        this.loopFrameCount = this.recordingFrameCount;

        this.currentBeat = 0;

        this.port.postMessage({
          type: "recording-stop",
          loopDuration: this.loopFrameCount,
          loopBeatCount: Math.ceil(this.loopFrameCount / this.framesPerBeat)
        });

        this.startLoop();
      } else {
        this.loopLayers.push(this.recordingData);

        this.currentRecordingFrame = 0;
        this.recordingData = [];
      }

      this.port.postMessage({
        type: "loop-layer-add",
        loopLayerCount: this.loopLayers.length
      });
    }

    this.isRecordingSilence = this.isRecordingWaitEnabled ? true : false;

    this.port.postMessage({ type: "recording-stop" });
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

  removeLoopLayer() {
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

  createMetronomeClick() {
    const samples = new Float32Array(this.metronomeClickSampleCount);

    const frequency = 1000;
    const amplitude = 1;
    const attackTime = 0.002; // 2ms
    const sustainTime = 0.02;
    const decayRate = 60;
    
    for (let sampleIndex = 0; sampleIndex < this.metronomeClickSampleCount; sampleIndex++) {
      const time = sampleIndex / sampleRate;

      let envelope = 0;

      if (time < attackTime) {
        envelope = (time / attackTime);
        envelope *= envelope;
      } else if (time < attackTime + sustainTime) {
        envelope = 1;
      } else {
        envelope = Math.exp(-(time - attackTime - sustainTime) * decayRate);
      }

      samples[sampleIndex] = amplitude * envelope * Math.sin(2 * Math.PI * frequency * time);
    }
    
    return samples;
  }

  processRecording(input, isInputMono, frameBufferSize) {
    for (let sampleIndex = 0; sampleIndex < frameBufferSize; sampleIndex++) {
      for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
        const channel = isInputMono ? input[0] : input[channelIndex];

        const recordingSampleIndex = sampleIndex + this.currentRecordingFrame;

        this.recordingData[channelIndex][recordingSampleIndex] = channel[sampleIndex] * this.loopGain;
      }
    }

    this.currentRecordingFrame += frameBufferSize;

    if (this.loopLayers.length === 0) {
      const currentBeat = Math.floor(this.currentRecordingFrame / this.framesPerBeat);

      if (currentBeat !== this.currentBeat) {
        this.currentBeat = currentBeat;
            
        this.sendLoopBeat();
      }
    }

    if (this.currentRecordingFrame >= this.recordingFrameCount) {
      if (this.loopLayers.length === 0) {
        this.stopRecording();
      } else {
        this.loopLayers.push(this.recordingData);

        this.currentRecordingFrame = 0;
        this.recordingData = new Array(this.channelCount)
          .fill(new Float32Array(this.recordingFrameCount));

        this.isRecordingSilence = true;

        this.port.postMessage({
          type: "loop-layer-add",
          loopLayerCount: this.loopLayers.length
        });
      }
    }
  }

  processRecordingMonitoring(input, output, isInputMono, frameBufferSize) {
    for (let sampleIndex = 0; sampleIndex < frameBufferSize; sampleIndex++) {
      for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
        const channel = isInputMono ? input[0] : input[channelIndex];

        output[channelIndex][sampleIndex] = channel[sampleIndex] * this.recordingMonitoringGain;
      }
    }
  }

  processRecordingWait(input, isInputMono, frameBufferSize) {
    let recordingInputLoudness = 0;

    for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
      const channel = isInputMono ? input[0] : input[channelIndex];

      let recordingSampleSquareSum = 0;

      for (let sampleIndex = 0; sampleIndex < frameBufferSize; sampleIndex++) {
        const recordingSample = channel[sampleIndex];

        recordingSampleSquareSum += recordingSample * recordingSample;
      }

      recordingInputLoudness += recordingSampleSquareSum;
    }

    recordingInputLoudness = Math.sqrt(recordingInputLoudness / (this.channelCount * frameBufferSize));

    if (recordingInputLoudness > this.recordingSilenceLevel) {         
      this.isRecordingSilence = false;

      if (this.isPlaying) {
        if (this.loopLayers.length > 0) {
          this.currentRecordingFrame = this.currentLoopFrame;
        }
      } else {
        if (this.isMetronomeEnabled) {
          const lastBeatFrame = Math.floor(this.currentMetronomeBeat * this.framesPerBeat);
          const deviationFrames = this.currentMetronomeFrame - lastBeatFrame;

          if (deviationFrames > this.metronomeDeviationToleranceFrames) {
            this.currentMetronomeFrame = 0;
            this.currentMetronomeBeat = 0;
            this.currentMetronomeClickSample = 0;
            this.isMetronomeClickActive = true;
          }
        }

        if (this.loopLayers.length === 0) {
          this.port.postMessage({ type: "recording-start" });
          this.port.postMessage({ type: "loop-beat-update", loopBeat: this.currentBeat + 1 });
        } else {
          this.port.postMessage({ type: "recording-start" });

          this.startLoop();
        }
      }
    }
  }

  processLoop(output, frameBufferSize) {
    for (let sampleIndex = 0; sampleIndex < frameBufferSize; sampleIndex++) {
      const loopSampleIndex = sampleIndex + this.currentLoopFrame;

      for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
        let mixedLoopSample = 0;

        for (const loopLayer of this.loopLayers) {
          mixedLoopSample += loopLayer[channelIndex][loopSampleIndex];
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

        output[channelIndex][sampleIndex] = loopSample;
      }
    }

    this.currentLoopFrame += frameBufferSize;

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

    if (this.currentLoopFrame >= this.loopFrameCount) {
      this.sendLoopTime();
        
      this.currentLoopFrame = 0;

      this.currentBeat = 0;
      this.currentSubBeat = 0;

      this.sendLoopBeat();
      this.sendLoopTime();
    }
  }

  processMetronome(output, frameBufferSize) {
    this.currentMetronomeFrame += frameBufferSize;

    const currentBeat = Math.floor(this.currentMetronomeFrame / this.framesPerBeat);

    if (currentBeat !== this.currentMetronomeBeat) {
      this.currentMetronomeBeat = currentBeat;
      this.isMetronomeClickActive = true;
    }

    if (this.isMetronomeClickActive) {
      for (let sampleIndex = 0; sampleIndex < frameBufferSize; sampleIndex++) {
        const metronomeClickSampleIndex = sampleIndex + this.currentMetronomeClickSample;

        for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
          const metronomeClickSample = this.metronomeClickSamples[metronomeClickSampleIndex];

          output[channelIndex][sampleIndex] = metronomeClickSample * this.metronomeGain;
        }
      }

      this.currentMetronomeClickSample += frameBufferSize;

      if (this.currentMetronomeClickSample >= this.metronomeClickSampleCount) {
        this.currentMetronomeClickSample = 0;
        this.isMetronomeClickActive = false;
      }
    }
  }

  process(inputs, outputs) {
    const recordingInput = inputs[0];

    const recordingOutput = outputs[0];
    const loopOutput = outputs[1];
    const metronomeOutput = outputs[2];

    const channelCount = Math.min(recordingInput.length, this.channelCount);
    const frameBufferSize = recordingOutput[0].length;

    const isInputMono = channelCount === 1;

    if (this.isRecording && !this.isRecordingMonitoringMuted) {
      this.processRecordingMonitoring(recordingInput, recordingOutput, isInputMono, frameBufferSize);
    }

    if (this.isRecording) {
      if (this.isRecordingSilence) {
        this.processRecordingWait(recordingInput, isInputMono, frameBufferSize);
      }

      if (!this.isRecordingSilence) {
        this.processRecording(recordingInput, isInputMono, frameBufferSize);
      }

      if (this.isMetronomeEnabled) {
        this.processMetronome(metronomeOutput, frameBufferSize);
      }
    }

    if (this.isPlaying) {
      this.processLoop(loopOutput, frameBufferSize);
    }

    return true;
  }
}

registerProcessor("looper-worklet", LooperWorkletProcessor);
