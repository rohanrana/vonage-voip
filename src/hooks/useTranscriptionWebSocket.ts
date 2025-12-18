"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import pEvent from "p-event";
import type {
  MessageDataType,
  RecordingProperties,
} from "@/types/transcription";

const sampleRate = 16000;
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "ws://localhost:3001";

export const useTranscriptionWebSocket = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [partialTranscript, setPartialTranscript] = useState<string>("");
  const [connectionStatus, setConnectionStatus] = useState<string>("");

  const mediaRecorderRef = useRef<AudioWorkletNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
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
      setConnectionStatus("Connecting to server...");

      // Connect to WebSocket backend
      const ws = new WebSocket(BACKEND_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("Connected to transcription server");
        setConnectionStatus("Initializing...");
        // Send start command
        ws.send(JSON.stringify({ type: "start" }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);

          if (message.type === "status") {
            console.log("Status:", message.message);
            setConnectionStatus(message.message);
          } else if (message.type === "transcription") {
            console.log(
              `Transcription: ${message.text} (Partial: ${message.isPartial})`
            );

            if (message.isPartial) {
              setPartialTranscript(message.text.trim());
            } else {
              setTranscript((prev) =>
                (prev + (prev ? " " : "") + message.text.trim()).trim()
              );
              setPartialTranscript("");
            }
          } else if (message.type === "error") {
            console.error("Server error:", message.message);
            setError(message.message);
            setConnectionStatus("Error");
          }
        } catch (err) {
          console.error("Error parsing message:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("Connection error");
        setConnectionStatus("Error");
      };

      ws.onclose = () => {
        console.log("Disconnected from server");
        if (isRecording) {
          setConnectionStatus("Disconnected");
        }
      };

      // Set up audio capture
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
        maxFrameCount: (audioContext.sampleRate * 1) / 10,
      };

      try {
        await audioContext.audioWorklet.addModule(
          "/worklets/recording-processor.js"
        );
      } catch (error) {
        console.log(`Add module error ${error}`);
        throw new Error("Failed to load audio worklet");
      }

      const mediaRecorder = new AudioWorkletNode(
        audioContext,
        "recording-processor",
        {
          processorOptions: recordingprops,
        }
      );

      const destination = audioContext.createMediaStreamDestination();
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.port.postMessage({
        message: "UPDATE_RECORDING_STATE",
        setRecording: true,
      });

      source.connect(mediaRecorder).connect(destination);

      mediaRecorder.port.onmessageerror = (error) => {
        console.log(`Error receiving message from worklet ${error}`);
      };

      const audioDataIterator = pEvent.iterator<
        "message",
        MessageEvent<MessageDataType>
      >(mediaRecorder.port, "message");

      // Process audio and send to backend
      (async () => {
        for await (const chunk of audioDataIterator) {
          if (chunk.data.message === "SHARE_RECORDING_BUFFER") {
            const audioBuffer = chunk.data.buffer[0];
            const originalSampleRate = chunk.data.originalSampleRate;
            const targetSampleRate = chunk.data.targetSampleRate;

            // Debug: Check audio levels
            const rms = Math.sqrt(
              audioBuffer.reduce((sum, val) => sum + val * val, 0) /
                audioBuffer.length
            );
            if (rms > 0.01) {
              console.log(
                `Audio: ${audioBuffer.length} samples, RMS: ${rms.toFixed(
                  4
                )}, ${originalSampleRate}Hz -> ${targetSampleRate}Hz`
              );
            }

            const abuffer = pcmEncode(audioBuffer);
            const audiodata = new Uint8Array(abuffer);
            console.log(
              `Sending PCM chunk: ${audiodata.length} bytes (${audioBuffer.length} samples at ${targetSampleRate}Hz)`
            );

            // Send audio data to WebSocket backend
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "audio",
                  data: Array.from(audiodata),
                })
              );
            }
          }
        }
      })();
    } catch (err: any) {
      console.error("Streaming error:", err);
      setError(err?.message || "Failed to start streaming");
      setConnectionStatus("Error");
      stopStreaming();
    }
  }, [pcmEncode, isRecording]);

  const stopStreaming = useCallback(async () => {
    // Send stop message to backend
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
      wsRef.current.close();
      wsRef.current = null;
    }

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.port.postMessage({
        message: "UPDATE_RECORDING_STATE",
        setRecording: false,
      });
      mediaRecorderRef.current.port.close();
      mediaRecorderRef.current.disconnect();
      mediaRecorderRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    setIsRecording(true);
    await startStreaming();
  }, [startStreaming]);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);
    setConnectionStatus("Disconnected");
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
