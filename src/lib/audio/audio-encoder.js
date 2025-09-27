class WaveAudioEncoder {
  formatData = {
    chunkId: "RIFF",
    chunkSize: 0,
    format: "WAVE",
    subchunk1Id: "fmt ",
    subchunk1Size: 16,
    audioFormat: 0,
    numberOfChannels: 0,
    sampleRate: 0,
    byteRate: 0,
    blockAlign: 0,
    bitsPerSample: 0,
    subchunk2Id: "data",
    subchunk2Size: 0
  };

  constructor(data, options) {
    this.data = data;

    this.frameCount = options?.frameCount ?? this.data[0].length;
    this.sampleRate = options?.sampleRate ?? 44100;
    this.use32bitFloat = options?.use32bitFloat ?? true;

    const channelCount = this.data.length;
    const bitsPerSample = this.use32bitFloat ? 32 : 16;
    const bytesPerSample = bitsPerSample / 8;
    const dataBytesCount = this.frameCount * channelCount * bytesPerSample;

    this.formatData.chunkSize = 4 + (8 + this.formatData.subchunk1Size) + (8 + dataBytesCount);
    this.formatData.subchunk2Size = dataBytesCount;
    this.formatData.audioFormat = this.use32bitFloat ? 3 : 1;
    this.formatData.numberOfChannels = channelCount;
    this.formatData.sampleRate = this.sampleRate;
    this.formatData.bitsPerSample = bitsPerSample;
    this.formatData.byteRate = this.sampleRate * channelCount * bytesPerSample;
    this.formatData.blockAlign = channelCount * bytesPerSample;
    
    this.encodedData = new ArrayBuffer(44 + this.formatData.subchunk2Size);
  }
  
  // Encode a string as 8-bit unsigned integers
  encodeString(dataView, offset, string) {
    for (let charIndex = 0; charIndex < string.length; charIndex++) {
      dataView.setUint8(offset + charIndex, string.charCodeAt(charIndex));
    }
  }

  // Encode 32-bit float samples as integer samples based on bit depth
  encodeSampleData(dataView, offset, data) {
    const channelCount = this.formatData.numberOfChannels;
    const bitDepth = this.formatData.bitsPerSample;

    for (let sampleIndex = 0; sampleIndex < this.frameCount; sampleIndex++) {
      for (let channelIndex = 0; channelIndex < channelCount; channelIndex++) {
        const channel = data[channelIndex];

        if (bitDepth === 32) {
          const sample = channel[sampleIndex];

          dataView.setFloat32(offset, sample, true);

          offset += 4;
        }

        // Convert the 32-bit float sample to a 16-bit signed integer sample
        if (bitDepth === 16) {
          const signedInt16Size = Math.pow(2, bitDepth) / 2;

          let sample = channel[sampleIndex] * signedInt16Size;

          if (sample < -signedInt16Size) {
            sample = Math.floor(-signedInt16Size);
          } else if (sample > signedInt16Size - 1) {
            sample = Math.floor(signedInt16Size - 1);
          } else {
            sample = Math.floor(sample);
          }

          dataView.setInt16(offset, sample, true);

          offset += 2;
        }
      }
    }
  }

  encode() {
    const encodedDataView = new DataView(this.encodedData);

    this.encodeString(encodedDataView, 0 ,this.formatData.chunkId);
    encodedDataView.setUint32(4, this.formatData.chunkSize, true);
    this.encodeString(encodedDataView, 8, this.formatData.format);

    this.encodeString(encodedDataView, 12, this.formatData.subchunk1Id);
    encodedDataView.setUint32(16, this.formatData.subchunk1Size, true);
    encodedDataView.setUint16(20, this.formatData.audioFormat, true);
    encodedDataView.setUint16(22, this.formatData.numberOfChannels, true);
    encodedDataView.setUint32(24, this.formatData.sampleRate, true);
    encodedDataView.setUint32(28, this.formatData.byteRate, true);
    encodedDataView.setUint16(32, this.formatData.blockAlign, true);
    encodedDataView.setUint32(34, this.formatData.bitsPerSample, true);

    this.encodeString(encodedDataView, 36, this.formatData.subchunk2Id);
    encodedDataView.setUint32(40, this.formatData.subchunk2Size, true);

    this.encodeSampleData(encodedDataView, 44, this.data);

    return this.encodedData;
  }
}

onmessage = ({ data }) => {
  if (data.event === "encode") {
    const waveAudioEncoder = new WaveAudioEncoder(data.audioData, {
      frameCount: data.frameCount,
      sampleRate: data.sampleRate,
      use32bitFloat: data.use32bitFloat
    });

    const encodedData = waveAudioEncoder.encode();

    postMessage({ event: "encode", encodedData, mimeType: "audio/wave" });
  }
};
