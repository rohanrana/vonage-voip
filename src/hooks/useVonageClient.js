// src/hooks/useVonageClient.js (for older Vonage SDK versions)
import { useRef, useState } from "react";
import { VonageClient } from "@vonage/client-sdk";

export const useVonageClient = () => {
  const [client, setClient] = useState(null);
  const [session, setSession] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState(null);
  const clientRef = useRef(null);

  const login = async (username) => {
    try {
      console.log("🔐 Logging in as:", username);

      // Get JWT from server
      const response = await fetch("http://localhost:3002/api/generate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });

      if (!response.ok) {
        throw new Error("Failed to get token from server");
      }

      const data = await response.json();
      console.log("✅ Token received");

      // Create Vonage client
      const vonageClient = new VonageClient();
      clientRef.current = vonageClient;

      console.log("🔄 Creating session...");
      console.log(
        "   VonageClient methods:",
        Object.getOwnPropertyNames(Object.getPrototypeOf(vonageClient))
      );

      // Try different session creation methods
      let newSession;

      if (typeof vonageClient.createSession === "function") {
        newSession = vonageClient.createSession(data.token);
      } else if (typeof vonageClient.login === "function") {
        newSession = await vonageClient.login(data.token);
      } else {
        throw new Error("No session creation method found on VonageClient");
      }

      console.log("✅ Session created");
      console.log("   Session object:", newSession);
      console.log(
        "   Session methods:",
        Object.getOwnPropertyNames(Object.getPrototypeOf(newSession || {}))
      );

      // Authenticate if needed
      if (typeof newSession.authenticate === "function") {
        console.log("🔄 Authenticating...");
        await newSession.authenticate();
        console.log("✅ Authenticated");
      }

      setClient(vonageClient);
      setSession(newSession);
      setIsAuthenticated(true);
      setError(null);

      return { client: vonageClient, session: newSession };
    } catch (err) {
      console.error("❌ Login failed:", err);
      setError(err.message);
      throw err;
    }
  };

  const logout = () => {
    console.log("🚪 Logging out");
    if (session) {
      if (typeof session.disconnect === "function") {
        session.disconnect();
      } else if (typeof session.logout === "function") {
        session.logout();
      }
    }
    setClient(null);
    setSession(null);
    setIsAuthenticated(false);
    setError(null);
  };

  return {
    client,
    session,
    isAuthenticated,
    error,
    login,
    logout,
  };
};
