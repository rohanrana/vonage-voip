// hooks/useCallAudio.js
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

export const useCallAudio = (callId) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const [callStatus, setCallStatus] = useState("idle");
  const [isMicrophoneActive, setIsMicrophoneActive] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [transcriptions, setTranscriptions] = useState([]);

  const socketRef = useRef(null);
  const audioContextRef = useRef(null);
  const nextStartTimeRef = useRef(0);
  const isInitializedRef = useRef(false);

  // Microphone refs
  const micStreamRef = useRef(null);
  const micSourceRef = useRef(null);
  const micProcessorRef = useRef(null);

  useEffect(() => {
    if (!callId) {
      console.log("⚠️ No callId provided yet");
      return;
    }

    const SOCKET_URL = "http://localhost:3002";

    console.log("🔌 Connecting to Socket.IO for call:", callId);

    // ✅ Create audio context
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioContextRef.current = new AudioContextClass({
      sampleRate: 16000,
      latencyHint: "interactive",
    });

    console.log(
      "🔊 Audio context created, initial state:",
      audioContextRef.current.state
    );
    console.log(
      "🔊 Audio context sample rate:",
      audioContextRef.current.sampleRate
    );

    // ✅ Resume audio context (CRITICAL for Chrome/Safari)
    const resumeAudioContext = async () => {
      if (audioContextRef.current.state === "suspended") {
        console.log("⏸️ Audio context suspended, resuming...");
        await audioContextRef.current.resume();
      }
      console.log(
        "🔊 Audio context state after resume:",
        audioContextRef.current.state
      );

      if (audioContextRef.current.state === "running") {
        isInitializedRef.current = true;
        nextStartTimeRef.current = audioContextRef.current.currentTime;
        console.log(
          "✅ Audio context ready!  Current time:",
          nextStartTimeRef.current
        );
      } else {
        console.error(
          "❌ Audio context not running:",
          audioContextRef.current.state
        );
      }
    };

    resumeAudioContext();

    // Connect to Socket.IO
    const socket = io(`${SOCKET_URL}/browser`, {
      transports: ["polling"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      path: "/socket.io/",
      forceNew: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket.IO connected:", socket.id);
      console.log("📡 Transport type:", socket.io.engine.transport.name);
      setIsConnected(true);
      setCallStatus("connecting");

      console.log("📝 Registering with callId:", callId);
      socket.emit("register", { callId });
    });

    socket.on("registered", (data) => {
      console.log("✅ Registered for call:", data.callId);
      console.log("📊 Registration data:", data);
      setCallStatus("connected");

      // Start microphone when registered
      setTimeout(() => {
        console.log("🎤 Starting microphone...");
        startMicrophone();
      }, 500);
    });

    socket.on("audio:data", (data) => {
      console.log("🔊 Received audio data from server");
      //   console.log("   Audio data exists:", !!data.audio);
      //   console.log("   Audio data length:", data.audio?.length);
      //   console.log("   Audio data size:", data.size, "bytes");
      //   console.log("   Audio context state:", audioContextRef.current?.state);
      //   console.log("   Is initialized:", isInitializedRef.current);

      if (!isInitializedRef.current || !audioContextRef.current) {
        console.error("❌ Audio context not ready!");
        // Try to resume
        if (audioContextRef.current) {
          audioContextRef.current.resume().then(() => {
            console.log("✅ Audio context resumed");
            isInitializedRef.current = true;
          });
        }
        return;
      }

      try {
        // Decode base64 audio
        const binaryString = atob(data.audio);
        console.log("   Decoded binary length:", binaryString.length);

        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        console.log("   Bytes array length:", bytes.length);
        console.log("   Calling playAudioChunk...");

        playAudioChunk(bytes.buffer);

        console.log("   ✅ playAudioChunk completed\n");
      } catch (err) {
        console.error("❌ Error processing audio:", err);
        console.error("   Error message:", err.message);
        console.error("   Error stack:", err.stack);
      }
    });
    socket.on("transcription", (data) => {
      console.log(`📝 Transcription [${data.speaker}]: `, data.transcript);

      setTranscriptions((prev) => [
        ...prev,
        {
          speaker: data.speaker,
          transcript: data.transcript,
          isFinal: data.isFinal,
          timestamp: data.timestamp,
        },
      ]);
    });

    socket.on("call:ended", () => {
      console.log("📞 Call ended by server");
      setCallStatus("ended");
      setIsConnected(false);
      stopMicrophone();
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket.IO disconnected:", reason);
      setIsConnected(false);
      setCallStatus("ended");
      stopMicrophone();
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket.IO connection error:", err);
      console.error("   Error message:", err.message);
      console.error("   Error type:", err.type);
      setError(`Failed to connect: ${err.message}`);
      setCallStatus("error");
    });

    socket.on("error", (err) => {
      console.error("❌ Socket.IO error:", err);
      setError(err.message || "Socket error occurred");
    });

    // Cleanup
    return () => {
      console.log("🧹 Cleaning up Socket.IO connection");
      stopMicrophone();
      if (socket.connected) {
        socket.disconnect();
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }
      isInitializedRef.current = false;
    };
  }, [callId]);

  // ✅ Play incoming audio chunk
  const playAudioChunk = (arrayBuffer) => {
    if (
      !audioContextRef.current ||
      audioContextRef.current.state !== "running"
    ) {
      return;
    }

    try {
      const audioContext = audioContextRef.current;
      const int16Array = new Int16Array(arrayBuffer);
      const float32Array = new Float32Array(int16Array.length);

      for (let i = 0; i < int16Array.length; i++) {
        let sample = int16Array[i] / 32768.0;
        if (sample > 1.0) sample = 1.0;
        if (sample < -1.0) sample = -1.0;
        float32Array[i] = sample;
      }

      const audioBuffer = audioContext.createBuffer(
        1,
        float32Array.length,
        16000
      );
      audioBuffer.getChannelData(0).set(float32Array);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;

      const gainNode = audioContext.createGain();
      gainNode.gain.value = 0.9;

      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      gainNode.gain.value = volume;
      const currentTime = audioContext.currentTime;
      const bufferDuration = float32Array.length / 16000;

      if (
        nextStartTimeRef.current < currentTime ||
        nextStartTimeRef.current > currentTime + 1
      ) {
        nextStartTimeRef.current = currentTime + 0.05;
      }

      source.start(nextStartTimeRef.current);
      nextStartTimeRef.current += bufferDuration;

      source.onended = () => {
        source.disconnect();
        gainNode.disconnect();
      };
    } catch (err) {
      console.error("❌ Error playing audio:", err);
      nextStartTimeRef.current = audioContextRef.current.currentTime;
    }
  };

  // In useCallAudio. js
  const [isMuted, setIsMuted] = useState(false);

  const toggleMute = () => {
    if (micProcessorRef.current) {
      if (!isMuted) {
        // Mute:  disconnect processor
        micProcessorRef.current.disconnect();
      } else {
        // Unmute: reconnect processor
        micProcessorRef.current.connect(audioContextRef.current.destination);
      }
      setIsMuted(!isMuted);
    }
  };

  // Return it
  // return { isConnected, error, disconnect, callStatus, isMicrophoneActive, isMuted, toggleMute };

  // ✅ Start microphone capture
  const startMicrophone = async () => {
    try {
      console.log("🎤 Requesting microphone access...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      });

      micStreamRef.current = stream;
      console.log("✅ Microphone access granted");
      console.log("   Audio tracks:", stream.getAudioTracks().length);
      console.log(
        "   Track settings:",
        stream.getAudioTracks()[0].getSettings()
      );
      setIsMicrophoneActive(true);

      // Create source from stream
      const source = audioContextRef.current.createMediaStreamSource(stream);
      micSourceRef.current = source;
      console.log("   Microphone source created");

      // Create processor
      const bufferSize = 2048;
      const processor = audioContextRef.current.createScriptProcessor(
        bufferSize,
        1,
        1
      );
      micProcessorRef.current = processor;
      console.log("   Script processor created, buffer size:", bufferSize);

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

        // Convert to Int16
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
        socketRef.current.emit("microphone:data", {
          audio: base64,
          callId: callId,
        });

        // Log occasionally (every 100 packets)
        packetCount++;
        if (packetCount % 100 === 0) {
          console.log(
            `🎤 Sent ${packetCount} microphone packets (${int16Data.length} samples each)`
          );
        }
      };

      // Connect:  source -> processor
      // DON'T connect processor to destination to avoid feedback loop
      source.connect(processor);
      processor.connect(audioContextRef.current.destination);

      console.log("🎤 Microphone streaming started\n");
    } catch (err) {
      console.error("❌ Failed to access microphone:", err);
      console.error("   Error name:", err.name);
      console.error("   Error message:", err.message);
      setError("Microphone access denied:  " + err.message);
      setIsMicrophoneActive(false);
    }
  };

  // ✅ Resample audio buffer
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

  // ✅ Stop microphone capture
  const stopMicrophone = () => {
    console.log("🎤 Stopping microphone...");

    if (micProcessorRef.current) {
      micProcessorRef.current.disconnect();
      micProcessorRef.current = null;
      console.log("   Processor disconnected");
    }

    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
      console.log("   Source disconnected");
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log("   Track stopped:", track.label);
      });
      micStreamRef.current = null;
    }

    setIsMicrophoneActive(false);
    console.log("✅ Microphone stopped\n");
  };

  const disconnect = () => {
    console.log("📞 Disconnecting call...");
    stopMicrophone();
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.disconnect();
    }
    setCallStatus("ended");
  };

  return {
    isConnected,
    error,
    disconnect,
    callStatus,
    isMicrophoneActive,
    toggleMute,
    volume,
    setVolume,
  };
};
