export type MessageDataType = {
  message: string;
  buffer: Float32Array[];
  recordingLength: number;
  originalSampleRate?: number;
  targetSampleRate?: number;
};

export type RecordingProperties = {
  numberOfChannels: number;
  sampleRate: number;
  maxFrameCount: number;
};

export type TranscriptResult = {
  text: string;
  isPartial: boolean;
  confidence?: number;
};

export type TranscriptionState = {
  isRecording: boolean;
  isConnected: boolean;
  error: string | null;
  transcript: string;
  partialTranscript: string;
  connectionStatus: string;
};
