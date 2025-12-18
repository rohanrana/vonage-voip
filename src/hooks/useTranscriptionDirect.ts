'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  LanguageCode
} from '@aws-sdk/client-transcribe-streaming';
import pEvent from 'p-event';
import type { MessageDataType, RecordingProperties } from '@/types/transcription';

const sampleRate = 16000;
const language = 'en-US' as LanguageCode;

export const useTranscriptionDirect = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [partialTranscript, setPartialTranscript] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<string>('');
  
  const mediaRecorderRef = useRef<AudioWorkletNode | null>(null);
  const transcriptionClientRef = useRef<TranscribeStreamingClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const pcmEncode = useCallback((input: Float32Array): ArrayBuffer => {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }, []);

  const startStreaming = useCallback(async () => {
    try {
      setError(null);
      setConnectionStatus('Starting...');

      const audioContext = new window.AudioContext();
      audioContextRef.current = audioContext;
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
      mediaStreamRef.current = stream;

      const source = audioContext.createMediaStreamSource(stream);

      const recordingprops: RecordingProperties = {
        numberOfChannels: 1,
        sampleRate: audioContext.sampleRate,
        maxFrameCount: audioContext.sampleRate * 1 / 10
      };

      try {
        await audioContext.audioWorklet.addModule('/worklets/recording-processor.js');
      } catch (error) {
        console.log(`Add module error ${error}`);
        throw new Error('Failed to load audio worklet');
      }

      const mediaRecorder = new AudioWorkletNode(
        audioContext,
        'recording-processor',
        {
          processorOptions: recordingprops,
        },
      );

      const destination = audioContext.createMediaStreamDestination();
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.port.postMessage({
        message: 'UPDATE_RECORDING_STATE',
        setRecording: true,
      });

      source.connect(mediaRecorder).connect(destination);
      
      mediaRecorder.port.onmessageerror = (error) => {
        console.log(`Error receiving message from worklet ${error}`);
      };

      const audioDataIterator = pEvent.iterator<'message', MessageEvent<MessageDataType>>(mediaRecorder.port, 'message');

      const getAudioStream = async function* () {
        for await (const chunk of audioDataIterator) {
          if (chunk.data.message === 'SHARE_RECORDING_BUFFER') {
            const audioBuffer = chunk.data.buffer[0];
            const originalSampleRate = chunk.data.originalSampleRate;
            const targetSampleRate = chunk.data.targetSampleRate;
            
            // Debug: Check audio levels
            const rms = Math.sqrt(audioBuffer.reduce((sum, val) => sum + val * val, 0) / audioBuffer.length);
            if (rms > 0.01) {
              console.log(`Audio: ${audioBuffer.length} samples, RMS: ${rms.toFixed(4)}, ${originalSampleRate}Hz -> ${targetSampleRate}Hz`);
            }
            
            const abuffer = pcmEncode(audioBuffer);
            const audiodata = new Uint8Array(abuffer);
            console.log(`Sending PCM chunk: ${audiodata.length} bytes (${audioBuffer.length} samples at ${targetSampleRate}Hz)`);
            yield {
              AudioEvent: {
                AudioChunk: audiodata,
              },
            };
          }
        }
      };

      const accessKeyId = process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID;
      const secretAccessKey = process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY;
      
      if (!accessKeyId || !secretAccessKey) {
        throw new Error('AWS credentials not found. Please set NEXT_PUBLIC_AWS_ACCESS_KEY_ID and NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY in your .env.local file');
      }

      const transcribeClient = new TranscribeStreamingClient({
        region: 'ap-southeast-1',
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      transcriptionClientRef.current = transcribeClient;

      const command = new StartStreamTranscriptionCommand({
        LanguageCode: language,
        MediaEncoding: 'pcm',
        MediaSampleRateHertz: sampleRate,
        AudioStream: getAudioStream(),
      });

      const data = await transcribeClient.send(command);
      console.log('Transcribe session established ', data.SessionId);
      setConnectionStatus('Connected to AWS Transcribe');

      if (data.TranscriptResultStream) {
        for await (const event of data.TranscriptResultStream) {
          if (event?.TranscriptEvent?.Transcript) {
            for (const result of event?.TranscriptEvent?.Transcript.Results || []) {
              if (result?.Alternatives && result?.Alternatives[0].Items) {
                let completeSentence = ``;
                for (let i = 0; i < result?.Alternatives[0].Items?.length; i++) {
                  completeSentence += ` ${result?.Alternatives[0].Items[i].Content}`;
                }
                console.log(`Transcription: ${completeSentence}`);
                
                if (result.IsPartial) {
                  setPartialTranscript(completeSentence.trim());
                } else {
                  setTranscript((prev) => (prev + (prev ? ' ' : '') + completeSentence.trim()).trim());
                  setPartialTranscript('');
                }
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Streaming error:', err);
      setError(err?.message || 'Failed to start streaming');
      setConnectionStatus('Error');
      stopStreaming();
    }
  }, [pcmEncode]);

  const stopStreaming = useCallback(async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.port.postMessage({
        message: 'UPDATE_RECORDING_STATE',
        setRecording: false,
      });
      mediaRecorderRef.current.port.close();
      mediaRecorderRef.current.disconnect();
      mediaRecorderRef.current = null;
    }

    if (transcriptionClientRef.current) {
      transcriptionClientRef.current.destroy();
      transcriptionClientRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setIsRecording(true);
    await startStreaming();
  }, [startStreaming]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    setConnectionStatus('Disconnected');
    await stopStreaming();
  }, [stopStreaming]);

  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return {
    isRecording,
    error,
    transcript,
    partialTranscript,
    connectionStatus,
    startRecording,
    stopRecording,
  };
};

