"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import pEvent from "p-event";

const SAMPLE_RATE = 16000; // Vonage sends 16kHz audio

// Helper to ensure WebSocket URL has proper protocol and format
function ensureWsProtocol(url) {
  if (!url) return url;

  // Remove any leading/trailing whitespace
  url = url.trim();

  // Fix common issue: wss:/// or ws:/// (triple slashes) → normalize to double
  url = url.replace(/^(wss? :)\/\/\/+/, "$1//");

  // Remove leading slashes if no protocol
  if (!url.startsWith("ws://") && !url.startsWith("wss://")) {
    url = url.replace(/^\/+/, "");
  }

  // If already has proper protocol, return it
  if (url.startsWith("ws://") || url.startsWith("wss://")) {
    return url;
  }

  // Default to ws for localhost, wss for others
  if (url.startsWith("localhost") || url.startsWith("127.0.0.1")) {
    return `ws://${url}`;
  }
  return `wss://${url}`;
}

const rawWsUrl = "wss://4bbb2f06ba22.ngrok-free.app/voice";
const BASE_WS_URL = ensureWsProtocol(rawWsUrl);

/**
 * Hook to handle bidirectional audio for voice calls:
 * - Captures microphone audio and sends to backend (browser → phone)
 * - Receives phone audio from backend and plays it (phone → browser)
 *
 * This is used for the browser leg in the voice-call flow:
 *   ws://.. .: 3001? role=browser&callId=<CALL_ID>
 */
export const useCallAudioWebSocket = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);

  const mediaRecorderRef = useRef(null);
  const wsRef = useRef(null);
  const audioContextRef = useRef(null);
  const mediaStreamRef = useRef(null);

  // For audio playback
  const playbackContextRef = useRef(null);
  const nextPlayTimeRef = useRef(0);
  const isPlaybackStartedRef = useRef(false);

  // Decode 16-bit PCM to Float32 for Web Audio API
  const pcmDecode = useCallback((pcmData) => {
    const int16Array = new Int16Array(pcmData);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      // Convert from 16-bit signed int to float (-1.0 to 1.0)
      float32Array[i] = int16Array[i] / 32768;
    }
    return float32Array;
  }, []);

  // Encode Float32 to 16-bit PCM for sending
  const pcmEncode = useCallback((input) => {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return buffer;
  }, []);

  // Play received audio through speakers
  const playAudio = useCallback(
    (pcmData) => {
      if (!playbackContextRef.current) {
        // Create playback audio context on first audio received
        playbackContextRef.current = new AudioContext({
          sampleRate: SAMPLE_RATE,
        });
        nextPlayTimeRef.current = playbackContextRef.current.currentTime;
        isPlaybackStartedRef.current = false;
      }

      const ctx = playbackContextRef.current;

      // Resume context if suspended (browser autoplay policy)
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const floatData = pcmDecode(pcmData);

      // Create audio buffer
      const audioBuffer = ctx.createBuffer(1, floatData.length, SAMPLE_RATE);
      audioBuffer.getChannelData(0).set(floatData);

      // Create buffer source
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      // Schedule playback
      const currentTime = ctx.currentTime;

      // Add small initial buffer delay for smoother playback
      if (!isPlaybackStartedRef.current) {
        nextPlayTimeRef.current = currentTime + 0.1; // 100ms initial buffer
        isPlaybackStartedRef.current = true;
      }

      // If we've fallen behind, reset timing
      if (nextPlayTimeRef.current < currentTime) {
        nextPlayTimeRef.current = currentTime + 0.05; // Small buffer to catch up
      }

      source.start(nextPlayTimeRef.current);

      // Schedule next chunk right after this one ends
      nextPlayTimeRef.current += audioBuffer.duration;
    },
    [pcmDecode]
  );

  /**
   * Request microphone permission early, while user gesture is still active.
   * Call this BEFORE any async API calls to ensure the gesture isn't consumed.
   */
  const requestMicrophonePermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: true,
      });
      return stream;
    } catch (err) {
      console.error("Microphone permission denied:", err);
      setError(
        err?.name === "NotAllowedError"
          ? "Microphone access denied.  Please allow microphone access in your browser settings."
          : err?.message || "Failed to access microphone"
      );
      return null;
    }
  }, []);

  const startForCall = useCallback(
    async (callId, sessionId, fromUserId, toUserId, existingStream) => {
      if (!callId) return;
      if (isStreaming) return;
      console.log("Starting audio for callId=", callId);
      try {
        setError(null);
        setIsStreaming(true);
        setSessionInfo({ sessionId, fromUserId, toUserId });

        const wsUrl = `${BASE_WS_URL}?role=browser&callId=${encodeURIComponent(
          callId
        )}&fromUserId=${encodeURIComponent(
          fromUserId
        )}&toUserId=${encodeURIComponent(
          toUserId
        )}&sessionId=${encodeURIComponent(sessionId)}`;
        const ws = new WebSocket(wsUrl);
        ws.binaryType = "arraybuffer"; // Important:  receive binary data as ArrayBuffer
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("Browser audio WS connected for callId=", callId);
        };

        ws.onerror = (e) => {
          console.error("Browser audio WS error:", e);
          setError("Audio WebSocket error");
        };

        ws.onclose = () => {
          console.log("Browser audio WS closed for callId=", callId);
        };

        // Handle incoming audio from phone (for playback)
        ws.onmessage = (event) => {
          console.log("Browser audio WS message:", event);
          if (event.data instanceof ArrayBuffer) {
            // Binary audio data from phone - play it
            playAudio(event.data);
          }
          // Ignore text messages (they might be status updates)
        };

        // Set up audio capture for microphone
        const audioContext = new window.AudioContext();
        audioContextRef.current = audioContext;

        // Use existing stream if provided, otherwise request new one
        const stream =
          existingStream ||
          (await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          }));
        mediaStreamRef.current = stream;

        const source = audioContext.createMediaStreamSource(stream);

        const recordingprops = {
          numberOfChannels: 1,
          sampleRate: audioContext.sampleRate,
          maxFrameCount: (audioContext.sampleRate * 1) / 10,
        };

        try {
          await audioContext.audioWorklet.addModule(
            "/worklets/recording-processor.js"
          );
        } catch (err) {
          console.error("Add AudioWorklet module error", err);
          throw new Error("Failed to load audio worklet");
        }

        const mediaRecorder = new AudioWorkletNode(
          audioContext,
          "recording-processor",
          {
            processorOptions: recordingprops,
          }
        );
        mediaRecorderRef.current = mediaRecorder;

        const destination = audioContext.createMediaStreamDestination();

        mediaRecorder.port.postMessage({
          message: "UPDATE_RECORDING_STATE",
          setRecording: true,
        });

        source.connect(mediaRecorder).connect(destination);

        mediaRecorder.port.onmessageerror = (err) => {
          console.error("Error receiving message from worklet", err);
        };

        const audioDataIterator = pEvent.iterator(
          mediaRecorder.port,
          "message"
        );

        (async () => {
          for await (const chunk of audioDataIterator) {
            if (chunk.data.message === "SHARE_RECORDING_BUFFER") {
              const audioBuffer = chunk.data.buffer[0];
              const abuffer = pcmEncode(audioBuffer);

              if (ws.readyState === WebSocket.OPEN) {
                // Send as binary for lower latency (much faster than JSON)
                ws.send(abuffer);
              }
            }
          }
        })();
      } catch (err) {
        console.error("Failed to start browser audio streaming:", err);
        setError(err?.message || "Failed to start audio streaming");
        setIsStreaming(false);
      }
    },
    [isStreaming, pcmEncode, playAudio]
  );

  const stop = useCallback(async () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
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

    if (playbackContextRef.current) {
      await playbackContextRef.current.close();
      playbackContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Reset playback state
    nextPlayTimeRef.current = 0;
    isPlaybackStartedRef.current = false;

    setIsStreaming(false);
    setSessionInfo(null);
  }, []);

  useEffect(() => {
    return () => {
      void stop();
    };
  }, [stop]);

  return {
    isStreaming,
    error,
    sessionInfo,
    requestMicrophonePermission,
    startForCall,
    stop,
  };
};
