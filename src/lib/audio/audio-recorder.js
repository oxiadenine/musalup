class RecorderWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    const { processorOptions } = options;

    this.channelCount = processorOptions.channelCount;
    this.frameCount = 0;
    this.sampleRate = processorOptions.sampleRate;

    this.isRecording = false;
    this.recordingFrameCount = this.sampleRate * (processorOptions.recordingDuration);
    this.recordedFrameCount = 0;
    this.recordingData = new Array(this.channelCount).fill(new Float32Array(this.recordingFrameCount));

    this.port.onmessage = ({ data }) => {
      if (data.type === "start") {
        this.isRecording = true;
      } else if (data.type === "stop") {
        this.isRecording = false;       

        this.port.postMessage({
          type: "stop",
          recordedFrameCount: this.recordedFrameCount,
          recordedData: this.recordedData
        });

        this.recordedFrameCount = 0;
        this.recordingData.fill(new Float32Array(this.recordingFrameCount));
      }
    };
  }

  get recordingTime() {
    return Math.round(this.recordedFrameCount / this.sampleRate * 1000) / 1000;
  }

  get recordedData() {
    const recordedData = new Array(this.channelCount).fill(new Float32Array(this.recordedFrameCount));

    for (let channelIndex = 0; channelIndex < this.channelCount; channelIndex++) {
      const channel = this.recordingData[channelIndex].slice(0, this.recordedFrameCount);

      recordedData[channelIndex] = channel;
    }
    
    return recordedData;
  }

  process(inputs, outputs, parameters) {
    if (inputs.length === 0) {
      return false;
    }

    const input = inputs[0];
    const output = outputs[0];

    const channelCount = Math.min(input.length, this.channelCount);

    for (let channelIndex = 0; channelIndex < channelCount; channelIndex++) {
      const channel = input[channelIndex];

      if (this.frameCount === 0) {
        this.frameCount = channel.length;
      }

      for (let sampleIndex = 0; sampleIndex < this.frameCount; sampleIndex++) {
        const sample = channel[sampleIndex];

        if (this.isRecording) {
          const recordingSampleIndex = sampleIndex + this.recordedFrameCount;

          this.recordingData[channelIndex][recordingSampleIndex] = sample;
        }

        output[channelIndex][sampleIndex] = sample;
      }
    }

    if (this.isRecording) {
      if (this.recordedFrameCount + this.frameCount < this.recordingFrameCount) {
        this.recordedFrameCount += this.frameCount;

        this.port.postMessage({
          type: "record",
          recordingTime: this.recordingTime
        });
      } else {
        this.recordedFrameCount += this.frameCount;

        this.port.postMessage({
          type: "record",
          recordingTime: this.recordingTime
        });

        this.isRecording = false;

        this.port.postMessage({
          type: "stop",
          recordedFrameCount: this.recordedFrameCount,
          recordedData: this.recordedData
        });

        this.recordedFrameCount = 0;
        this.recordingData.fill(new Float32Array(this.recordingFrameCount));

        return false;
      }
    }

    return true;
  }
}

registerProcessor("recorder-worklet", RecorderWorkletProcessor);
