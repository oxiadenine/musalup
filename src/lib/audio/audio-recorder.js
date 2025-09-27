class RecorderWorkletProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    this.channelCount = options?.processorOptions?.channelCount ?? 0;
    this.sampleRate = options?.processorOptions?.sampleRate ?? 0;
    this.recordingFrames = this.sampleRate * (options?.processorOptions?.recordingTime ?? 0);
    this.recordingIntervalFrames = this.sampleRate * (15 / 1000);

    this.isRecording = false;
    this.recordedFrames = 0;
    this.recordedData = new Array(this.channelCount).fill(new Float32Array(this.recordingFrames));

    this.processingFrameCount = 0;
    this.processedFrames = 0;

    this.port.onmessage = ({ data }) => {
      if (data.event === "start") {
        this.isRecording = true;
      } else if (data.event === "stop") {
        this.isRecording = false;

        this.port.postMessage({
          event: "stop",
          recordedFrames: this.recordedFrames,
          recordedData: this.recordedData
        });
      }
    };
  }

  get recordingLength() {
    return Math.round(this.recordedFrames / this.sampleRate * 1000) / 1000;
  }

  process(inputs, outputs, parameters) {
    const inputCount = inputs.length > 1 ? 1 : inputs.length;

    for (let inputIndex = 0; inputIndex < inputCount; inputIndex++) {
      const input = inputs[inputIndex];

      const channelCount = input.length !== this.channelCount ? input.length : this.channelCount;

      for (let channelIndex = 0; channelIndex < channelCount; channelIndex++) {
        const channel = input[channelIndex];

        if (this.processingFrameCount === 0) {
          this.processingFrameCount = channel.length;
        }

        for (let sampleIndex = 0; sampleIndex < this.processingFrameCount; sampleIndex++) {
          const sample = channel[sampleIndex];

          if (this.isRecording) {
            const recordingSampleIndex = sampleIndex + this.recordedFrames;

            this.recordedData[channelIndex][recordingSampleIndex] = sample;
          }

          outputs[inputIndex][channelIndex][sampleIndex] = sample;
        }
      }
    }

    if (this.isRecording) {
      if (this.recordedFrames + this.processingFrameCount < this.recordingFrames) {
        this.recordedFrames += this.processingFrameCount;

        if (this.processedFrames >= this.recordingIntervalFrames) {
          this.processedFrames = 0;

          this.port.postMessage({
            event: "record",
            recordingLength: this.recordingLength
          });
        } else {
          this.processedFrames += this.processingFrameCount;
        }
      } else {
        this.recordedFrames += this.processingFrameCount;

        this.port.postMessage({
          event: "record",
          recordingLength: this.recordingLength
        });

        this.isRecording = false;

        this.port.postMessage({
          event: "stop",
          recordedFrames: this.recordedFrames,
          recordedData: this.recordedData
        });

        return false;
      }
    }

    return true;
  }
}

registerProcessor("recorder-worklet", RecorderWorkletProcessor);
