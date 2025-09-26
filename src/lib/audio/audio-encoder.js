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
    
    this.encodedData = new Uint8Array(44 + this.formatData.subchunk2Size);
  }
  
  // Write a string as 16-bit integers with byte order (big-endian)
  writeString(string, offset) {
    for (let charIndex = 0; charIndex < string.length; charIndex++) {
      this.encodedData[offset + charIndex] = string.charCodeAt(charIndex);
    }
  }

  // Write an integer as a 16-bit integer with byte order (little-endian)
  writeInt16(integer, offset) {
    this.encodedData[offset + 0] = integer & 255;
    this.encodedData[offset + 1] = (integer >> 8) & 255;
  }

  // Write an integer as a 32-bit integer with byte order (little-endian)
  writeInt32(integer, offset) {
    this.encodedData[offset + 0] = integer & 255;
    this.encodedData[offset + 1] = (integer >> 8) & 255;
    this.encodedData[offset + 2] = (integer >> 16) & 255;
    this.encodedData[offset + 3] = (integer >> 24) & 255;
  }

  // Write 32-bit float samples as integer samples based on bit depth
  writeSampleData(data, offset) {
    const channelCount = this.formatData.numberOfChannels;
    const bitDepth = this.formatData.bitsPerSample;

    for (let sampleIndex = 0; sampleIndex < this.frameCount; sampleIndex++) {
      for (let channelIndex = 0; channelIndex < channelCount; channelIndex++) {
        const channel = data[channelIndex];

        // Convert the 32-bit float sample to a 32-bit signed integer sample
        if (bitDepth === 32) {
          const sampleBuffer = new ArrayBuffer(4);

          (new Float32Array(sampleBuffer))[0] = channel[sampleIndex];
          let sample = (new Uint32Array(sampleBuffer))[0];

          // Convert to a signed integer
          sample = sample | 0;

          this.writeInt32(sample, offset);

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

          this.writeInt16(sample, offset);

          offset += 2;
        }
      }
    }
  }

  encode() {
    this.writeString(this.formatData.chunkId, 0);
    this.writeInt32(this.formatData.chunkSize, 4);
    this.writeString(this.formatData.format, 8);

    this.writeString(this.formatData.subchunk1Id, 12);
    this.writeInt32(this.formatData.subchunk1Size, 16);
    this.writeInt16(this.formatData.audioFormat, 20);
    this.writeInt16(this.formatData.numberOfChannels, 22);
    this.writeInt32(this.formatData.sampleRate, 24);
    this.writeInt32(this.formatData.byteRate, 28);
    this.writeInt16(this.formatData.blockAlign, 32);
    this.writeInt32(this.formatData.bitsPerSample, 34);

    this.writeString(this.formatData.subchunk2Id, 36);
    this.writeInt32(this.formatData.subchunk2Size, 40);

    this.writeSampleData(this.data, 44);

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
