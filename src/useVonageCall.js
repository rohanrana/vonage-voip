// hooks/useVonageCall.js
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export const useVonageCall = (session) => {
  const [call, setCall] = useState(null);
  const [callId, setCallId] = useState(null);
  const [callStatus, setCallStatus] = useState("idle");
  const [transcriptions, setTranscriptions] = useState([]);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const localProcessorRef = useRef(null);
  const remoteProcessorRef = useRef(null);
  const localSourceRef = useRef(null);
  const remoteSourceRef = useRef(null);

  // Start call
  const startCall = async (phoneNumber) => {
    try {
      console.log("📞 Starting call to:", phoneNumber);
      setCallStatus("connecting");
      setTranscriptions([]); // Clear previous transcriptions

      // Create server call using Vonage Client SDK
      const newCall = await session.serverCall({
        to: phoneNumber,
      });

      setCall(newCall);

      // Use conversation ID as callId
      const conversationId = newCall.conversation?.id || `call-${Date.now()}`;
      setCallId(conversationId);

      console.log("✅ Call initiated");
      console.log("   Call ID:", newCall);
      console.log("   Call object:", newCall);
      console.log("   Conversation ID:", conversationId);

      // Connect to Socket.IO for transcription
      connectToTranscription(conversationId);

      // Listen to call status changes
      // newCall.on("call:status:changed", async (status) => {
      //   console.log("📞 Call status:", status);
      //   setCallStatus(status);

      //   if (status === "answered") {
      //     console.log("✅ Call answered - setting up audio capture");
      //     // Wait a bit for streams to be ready
      //     setTimeout(() => {
      //       setupAudioCapture(newCall, conversationId);
      //     }, 500);
      //   }

      //   if (
      //     status === "completed" ||
      //     status === "failed" ||
      //     status === "rejected"
      //   ) {
      //     console.log("📞 Call ended");
      //     cleanup();
      //   }
      // });

      // newCall.on("call:error", (err) => {
      //   console.error("❌ Call error:", err);
      //   setError(err.message || "Call error occurred");
      //   setCallStatus("failed");
      // });

      return newCall;
    } catch (err) {
      console.error("❌ Failed to start call:", err);
      setError(err.message);
      setCallStatus("failed");
      throw err;
    }
  };

  // Connect to Socket.IO for transcription
  const connectToTranscription = (conversationId) => {
    const SOCKET_URL = "http://localhost:3002";

    console.log("🔌 Connecting to transcription server");

    const socket = io(`${SOCKET_URL}/browser`, {
      transports: ["polling"],
      reconnection: true,
      path: "/socket.io/",
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Connected to transcription server");
      socket.emit("register", { callId: conversationId });
    });

    socket.on("registered", (data) => {
      console.log("✅ Registered for transcription:", data);
    });

    socket.on("audio:transcribe", (data) => {
      console.log(`📝 Transcription [${data.speaker}]: `, data.transcript);

      setTranscriptions((prev) => {
        // If it's a partial result, replace the last partial from same speaker
        if (!data.isFinal) {
          const filtered = prev.filter(
            (t) => t.isFinal || t.speaker !== data.speaker
          );
          return [...filtered, data];
        }
        // If final, just add it
        return [...prev, data];
      });
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from transcription server");
    });
  };

  // Setup audio capture for both streams
  const setupAudioCapture = async (activeCall, conversationId) => {
    try {
      console.log("🎤 Setting up audio capture for transcription");

      // Create audio context
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)({
        sampleRate: 16000,
      });

      await audioContextRef.current.resume();
      console.log("✅ Audio context created and resumed");

      // ✅ Get local stream (browser user's microphone)
      const localStream = await activeCall.getLocalMediaStream();
      if (localStream) {
        console.log("🎤 Capturing local (browser) audio");
        captureAudioStream(localStream, conversationId, "browser");
      } else {
        console.warn("⚠️ No local stream available");
      }

      // ✅ Get remote stream (phone user's audio)
      const remoteStream = await activeCall.getRemoteMediaStream();
      if (remoteStream) {
        console.log("📞 Capturing remote (phone) audio");
        captureAudioStream(remoteStream, conversationId, "phone");
      } else {
        console.warn("⚠️ No remote stream available yet");
        // Retry after delay
        setTimeout(async () => {
          const retryRemoteStream = await activeCall.getRemoteMediaStream();
          if (retryRemoteStream) {
            console.log("📞 Capturing remote (phone) audio (retry)");
            captureAudioStream(retryRemoteStream, conversationId, "phone");
          }
        }, 1000);
      }

      console.log("✅ Audio capture setup complete");
    } catch (err) {
      console.error("❌ Failed to setup audio capture:", err);
      setError("Failed to capture audio:  " + err.message);
    }
  };

  // Capture audio stream and send to server
  const captureAudioStream = (stream, conversationId, speaker) => {
    try {
      console.log(`🎙️ Starting ${speaker} audio capture`);

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const processor = audioContextRef.current.createScriptProcessor(
        2048,
        1,
        1
      );

      // Store references
      if (speaker === "browser") {
        localSourceRef.current = source;
        localProcessorRef.current = processor;
      } else {
        remoteSourceRef.current = source;
        remoteProcessorRef.current = processor;
      }

      let packetCount = 0;

      processor.onaudioprocess = (e) => {
        if (!socketRef.current || !socketRef.current.connected) {
          return;
        }

        const inputData = e.inputBuffer.getChannelData(0);
        const sampleRate = audioContextRef.current.sampleRate;

        // Resample if needed
        let outputData = inputData;
        if (sampleRate !== 16000) {
          outputData = resampleBuffer(inputData, sampleRate, 16000);
        }

        // Convert Float32 to Int16
        const int16Data = new Int16Array(outputData.length);
        for (let i = 0; i < outputData.length; i++) {
          let sample = outputData[i];
          if (sample > 1) sample = 1;
          if (sample < -1) sample = -1;
          int16Data[i] = sample * 32767;
        }

        // Convert to base64
        const base64 = btoa(
          new Uint8Array(int16Data.buffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );

        // Send to server
        socketRef.current.emit("audio:transcribe", {
          audio: base64,
          callId: conversationId,
          speaker: speaker,
        });

        // Log occasionally
        packetCount++;
        if (packetCount % 100 === 0) {
          console.log(`🎤 Sent ${packetCount} ${speaker} audio packets`);
        }
      };

      // Connect:  source -> processor -> destination (to avoid echo, don't connect to destination)
      source.connect(processor);
      // DON'T connect to destination to avoid feedback
      // processor.connect(audioContextRef.current.destination);

      console.log(`✅ ${speaker} audio capture started`);
    } catch (err) {
      console.error(`❌ Failed to capture ${speaker} audio:`, err);
    }
  };

  // Resample audio buffer
  const resampleBuffer = (buffer, fromRate, toRate) => {
    if (fromRate === toRate) return buffer;

    const ratio = fromRate / toRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const position = i * ratio;
      const index = Math.floor(position);
      const fraction = position - index;

      if (index + 1 < buffer.length) {
        result[i] =
          buffer[index] * (1 - fraction) + buffer[index + 1] * fraction;
      } else {
        result[i] = buffer[index];
      }
    }

    return result;
  };

  // End call
  const endCall = () => {
    console.log("📞 Ending call");
    if (call) {
      call.hangup();
    }
    cleanup();
  };

  // Cleanup
  const cleanup = () => {
    console.log("🧹 Cleaning up audio resources");

    // Stop processors
    if (localProcessorRef.current) {
      localProcessorRef.current.disconnect();
      localProcessorRef.current = null;
    }
    if (remoteProcessorRef.current) {
      remoteProcessorRef.current.disconnect();
      remoteProcessorRef.current = null;
    }

    // Stop sources
    if (localSourceRef.current) {
      localSourceRef.current.disconnect();
      localSourceRef.current = null;
    }
    if (remoteSourceRef.current) {
      remoteSourceRef.current.disconnect();
      remoteSourceRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Disconnect socket
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setCall(null);
    setCallId(null);
    setCallStatus("idle");
  };

  return {
    call,
    callId,
    callStatus,
    transcriptions,
    error,
    startCall,
    endCall,
  };
};
