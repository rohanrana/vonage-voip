// High-quality audio resampling worklet processor for voice calls
// Uses proper anti-aliasing filter to avoid glitchy audio

class RecordingProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.sampleRate = 48000; // Default, will be overridden
    this.maxRecordingFrames = 0;
    this.numberOfChannels = 1;
    this.targetSampleRate = 16000; // Vonage expects 16kHz

    if (options && options.processorOptions) {
      const {
        numberOfChannels,
        sampleRate,
        maxFrameCount,
      } = options.processorOptions;

      this.sampleRate = sampleRate || 48000;
      this.maxRecordingFrames = maxFrameCount || Math.ceil(this.sampleRate * 0.1);
      this.numberOfChannels = numberOfChannels || 1;
    }

    // Calculate resample ratio
    this.resampleRatio = this.sampleRate / this.targetSampleRate;
    
    // Recording buffer at native sample rate
    this._recordingBuffer = new Float32Array(this.maxRecordingFrames);
    this.recordedFrames = 0;
    this.isRecording = false;

    // Publish every ~100ms worth of 16kHz samples (1600 samples)
    this.targetChunkSize = Math.floor(this.targetSampleRate * 0.1); // 1600 samples at 16kHz
    this.nativeChunkSize = Math.floor(this.sampleRate * 0.1); // Equivalent at native rate

    // Anti-aliasing filter state (simple low-pass IIR filter)
    // Cutoff at ~7kHz (Nyquist for 16kHz is 8kHz, leave some margin)
    this.filterCoeff = this._calculateLowPassCoeff(7000, this.sampleRate);
    this.filterState = 0;

    // Resampling state for fractional sample handling
    this.resampleAccumulator = 0;
    this.lastSample = 0;

    this.port.onmessage = (event) => {
      if (event.data.message === 'UPDATE_RECORDING_STATE') {
        this.isRecording = event.data.setRecording;
        if (!this.isRecording) {
          // Reset state when stopping
          this.recordedFrames = 0;
          this.filterState = 0;
          this.resampleAccumulator = 0;
          this.lastSample = 0;
        }
      }
    };
  }

  // Calculate single-pole low-pass filter coefficient
  _calculateLowPassCoeff(cutoffHz, sampleRate) {
    const rc = 1.0 / (2.0 * Math.PI * cutoffHz);
    const dt = 1.0 / sampleRate;
    return dt / (rc + dt);
  }

  // Apply low-pass anti-aliasing filter
  _applyLowPass(sample) {
    this.filterState += this.filterCoeff * (sample - this.filterState);
    return this.filterState;
  }

  // High-quality resampling with anti-aliasing
  _resampleWithAntiAliasing(inputBuffer, numSamples) {
    if (numSamples === 0) return new Float32Array(0);
    
    // Calculate output size
    const outputLength = Math.floor(numSamples / this.resampleRatio);
    if (outputLength === 0) return new Float32Array(0);
    
    const outputBuffer = new Float32Array(outputLength);
    
    let outputIndex = 0;
    let inputIndex = this.resampleAccumulator;
    
    while (outputIndex < outputLength && inputIndex < numSamples) {
      const intIndex = Math.floor(inputIndex);
      const frac = inputIndex - intIndex;
      
      // Get samples for interpolation (with bounds checking)
      const s0 = intIndex > 0 ? inputBuffer[intIndex - 1] : this.lastSample;
      const s1 = inputBuffer[intIndex];
      const s2 = intIndex + 1 < numSamples ? inputBuffer[intIndex + 1] : s1;
      const s3 = intIndex + 2 < numSamples ? inputBuffer[intIndex + 2] : s2;
      
      // Cubic interpolation for smoother output
      const sample = this._cubicInterpolate(s0, s1, s2, s3, frac);
      
      // Apply anti-aliasing filter
      outputBuffer[outputIndex] = this._applyLowPass(sample);
      
      outputIndex++;
      inputIndex += this.resampleRatio;
    }
    
    // Save state for next buffer
    this.resampleAccumulator = inputIndex - numSamples;
    if (numSamples > 0) {
      this.lastSample = inputBuffer[numSamples - 1];
    }
    
    // Return actual output (may be slightly less than calculated)
    return outputBuffer.subarray(0, outputIndex);
  }

  // Cubic interpolation for smooth resampling
  _cubicInterpolate(y0, y1, y2, y3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    
    // Catmull-Rom spline interpolation
    const a0 = -0.5 * y0 + 1.5 * y1 - 1.5 * y2 + 0.5 * y3;
    const a1 = y0 - 2.5 * y1 + 2.0 * y2 - 0.5 * y3;
    const a2 = -0.5 * y0 + 0.5 * y2;
    const a3 = y1;
    
    return a0 * t3 + a1 * t2 + a2 * t + a3;
  }

  process(inputs, outputs) {
    if (!this.isRecording) {
      return true;
    }

    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const inputChannel = input[0];
    const samplesToProcess = inputChannel.length;

    // Copy input samples to recording buffer
    for (let i = 0; i < samplesToProcess; i++) {
      if (this.recordedFrames < this.maxRecordingFrames) {
        this._recordingBuffer[this.recordedFrames] = inputChannel[i];
        this.recordedFrames++;
      }
    }

    // Pass through to output (for monitoring if needed)
    const output = outputs[0];
    if (output && output[0]) {
      for (let i = 0; i < samplesToProcess; i++) {
        output[0][i] = inputChannel[i];
      }
    }

    // Check if we have enough samples for a chunk (~100ms at native rate)
    if (this.recordedFrames >= this.nativeChunkSize) {
      // Extract the recorded samples
      const nativeSamples = this._recordingBuffer.slice(0, this.recordedFrames);
      
      // Resample to 16kHz with anti-aliasing
      const resampledBuffer = this._resampleWithAntiAliasing(nativeSamples, this.recordedFrames);
      
      if (resampledBuffer.length > 0) {
        this.port.postMessage({
          message: 'SHARE_RECORDING_BUFFER',
          buffer: [resampledBuffer],
          recordingLength: resampledBuffer.length,
          originalSampleRate: this.sampleRate,
          targetSampleRate: this.targetSampleRate
        });
      }

      // Reset recording buffer
      this.recordedFrames = 0;
    }

    return true;
  }
}

registerProcessor('recording-processor', RecordingProcessor);
