class LooperWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const { processorOptions } = options;

    this.channelCount = options.outputChannelCount[0];

    this.recordingDuration = processorOptions.recordingDuration;
    this.isRecordingMuted = processorOptions.isRecordingMuted;
    this.beatsPerMinute = processorOptions.beatsPerMinute;

    this.framesPerBeat = Math.ceil(60 / this.beatsPerMinute * sampleRate);
    this.framesPerSubBeat = sampleRate / 30;
    this.beatCount = 0;
    this.subBeatCount = 0;

    this.isRecording = false;
    this.isPlaying = false;

    this.recordingFrameCount = 0;
    this.currentRecordingFrame = 0;
    this.isRecordingSilence = true;
    this.recordingData = [];

    this.loopFrameCount = 0;
    this.currentLoopFrame = 0;
    this.loopLayers = [];

    this.port.onmessage = ({ data }) => {
      if (data.type === "recording-start") {
        this.startRecording();
      } else if (data.type === "recording-stop") {
        this.stopRecording();
      } else if (data.type === "recording-mute") {
        this.isRecordingMuted = data.isRecordingMuted;
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
      }
    }
  }

  startRecording() {
    this.isRecording = true;
        
    if (this.loopLayers.length === 0) {
      this.recordingFrameCount = Math.ceil(this.recordingDuration * sampleRate);

      this.recordingData = new Array(this.channelCount)
        .fill(new Float32Array(this.recordingFrameCount));

      this.port.postMessage({ type: "loop-beat-update", loopBeat: this.beatCount + 1 });
    } else {
      this.recordingData = new Array(this.channelCount)
        .fill(new Float32Array(this.loopFrameCount));
    }

    this.port.postMessage({ type: "recording-start" });

    if (this.loopLayers.length > 0 && !this.isPlaying) {
      this.isPlaying = true;

      this.port.postMessage({ type: "loop-start" });
    }
  }

  stopRecording() {
    this.isRecording = false;

    if (this.loopLayers.length === 0) {
      this.recordingFrameCount = this.currentRecordingFrame;

      const recordedData = new Array(this.channelCount);

      for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
        recordedData[channelIndex] = this.recordingData[channelIndex].slice(0, this.recordingFrameCount);
      }

      this.loopLayers.push(recordedData);

      this.loopFrameCount = this.recordingFrameCount;

      this.beatCount = 0;

      this.port.postMessage({
        type: "recording-stop",
        loopDuration: this.loopFrameCount,
        loopBeatCount: Math.ceil(this.loopFrameCount / this.framesPerBeat)
      });

      this.isPlaying = true;

      this.port.postMessage({ type: "loop-start" });
      this.port.postMessage({ type: "loop-beat-update", loopBeat: this.beatCount + 1 });
    } else {
      if (!this.isRecordingSilence) {
        this.isRecordingSilence = true;

        this.loopLayers.push(this.recordingData);

        this.recordingData = new Array(this.channelCount)
          .fill(new Float32Array(this.loopFrameCount));
      }
    }

    this.port.postMessage({ type: "recording-stop" });

    this.port.postMessage({
      type: "loop-layer-add",
      loopLayerCount: this.loopLayers.length
    });

    this.isRecordingSilence = true;
    this.recordingData = [];
    this.currentRecordingFrame = 0;
  }

  startLoop() {
    this.isPlaying = true;

    this.port.postMessage({ type: "loop-start" });
    this.port.postMessage({ type: "loop-beat-update", loopBeat: this.beatCount + 1 });
  }

  stopLoop() {
    this.isPlaying = false;
    this.currentLoopFrame = 0;

    this.beatCount = 0;
    this.subBeatCount = 0;

    this.port.postMessage({ type: "loop-stop" });
    this.port.postMessage({ type: "loop-beat-update", loopBeat: this.beatCount + 1 });
  }

  clearLoop() {
    this.recordingFrameCount = Math.ceil(this.recordingDuration * sampleRate);
    
    this.loopFrameCount = 0;
    this.loopLayers = [];

    this.port.postMessage({ type: "loop-clear" });
    this.port.postMessage({ type: "loop-beat-update", loopBeat: this.beatCount });
  }

  removeLastLoopLayer() {
    this.loopLayers.pop();

    this.port.postMessage({
      type: "loop-layer-remove",
      loopLayerCount: this.loopLayers.length
    });
  }

  sendLoopBeat() {
    this.port.postMessage({ type: "loop-beat-update", loopBeat: this.beatCount + 1 });
  }

  sendLoopTime() {
    this.port.postMessage({ type: "loop-time-update", loopTime: this.currentLoopFrame });
  }

  process(inputs, outputs) {
    const recordingInput = inputs[0];
    const recordingOutput = outputs[0];

    const loopOutput = outputs[1];

    const channelCount = Math.min(recordingInput.length, this.channelCount);
    const frameBufferSize = recordingOutput[0].length;

    const isInputMono = channelCount === 1;

    if (this.isRecording && !this.isRecordingMuted) {
      for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
        const channel = isInputMono ? recordingInput[0] : recordingInput[channelIndex];

        recordingOutput[channelIndex].set(channel);
      }
    }

    if (this.loopLayers.length > 0 && this.isPlaying) {
      for (let sampleIndex = 0; sampleIndex < frameBufferSize; sampleIndex++) {
        const loopSampleIndex = sampleIndex + this.currentLoopFrame;

        for (const loopLayer of this.loopLayers) {
          for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
            loopOutput[channelIndex][sampleIndex] += loopLayer[channelIndex][loopSampleIndex];
          }
        }
      }
    }

    if (this.isRecording) {
      const sampleTrigger = 0.05;
      
      for (let sampleIndex = 0; sampleIndex < frameBufferSize; sampleIndex++) {
        for (let channelIndex = 0; channelIndex < channelCount; channelIndex++) {
          const channel = isInputMono ? recordingInput[0] : recordingInput[channelIndex];

          if (Math.abs(channel[sampleIndex]) > sampleTrigger) {
            this.isRecordingSilence = false;
          }

          if (this.loopLayers.length === 0) {
            const recordingSampleIndex = sampleIndex + this.currentRecordingFrame;

            this.recordingData[channelIndex][recordingSampleIndex] = channel[sampleIndex];
          } else {
            const recordingSampleIndex = sampleIndex + this.currentLoopFrame;

            this.recordingData[channelIndex][recordingSampleIndex] = channel[sampleIndex];
          }
        }
      }

      if (this.loopLayers.length === 0) {
        this.currentRecordingFrame += frameBufferSize;

        const currentBeat = Math.floor(this.currentRecordingFrame / this.framesPerBeat);

        if (currentBeat !== this.beatCount) {
          this.beatCount = currentBeat;
        
          this.sendLoopBeat();
        }

        if (this.currentRecordingFrame === this.recordingFrameCount) {
          this.stopRecording();
        }
      }
    }

    if (this.loopLayers.length > 0 && this.isPlaying) {
      this.currentLoopFrame += frameBufferSize;

      const currentBeat = Math.floor(this.currentLoopFrame / this.framesPerBeat);

      if (currentBeat !== this.beatCount) {
        this.beatCount = currentBeat;
        
        this.sendLoopBeat();
      }

      const currentSubBeat = Math.floor(this.currentLoopFrame / this.framesPerSubBeat);

      if (currentSubBeat !== this.subBeatCount) {
        this.subBeatCount = currentSubBeat;

        this.sendLoopTime();
      }

      if (this.currentLoopFrame === this.loopFrameCount) {
        if (this.isRecording && !this.isRecordingSilence) {
          this.isRecordingSilence = true;

          this.loopLayers.push(this.recordingData);

          this.recordingData = new Array(this.channelCount)
            .fill(new Float32Array(this.loopFrameCount));

          this.port.postMessage({
            type: "loop-layer-add",
            loopLayerCount: this.loopLayers.length
          });
        }

        this.sendLoopTime();
        
        this.currentLoopFrame = 0;

        this.beatCount = 0;
        this.subBeatCount = 0;

        this.sendLoopBeat();
        this.sendLoopTime();
      }
    }

    return true;
  }
}

registerProcessor("looper-worklet", LooperWorkletProcessor);
