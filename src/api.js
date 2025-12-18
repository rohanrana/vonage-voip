// src/api.js
export const getVonageToken = async () => {
  try {
    const res = await fetch("http://localhost:3002/api/token");
    const data = await res.json();
    return data.token;
  } catch (err) {
    console.error("Error fetching token:", err);
    throw err;
  }
};

export async function makeCallAPI(to) {
  try {
    const response = await fetch(
      "https://4bbb2f06ba22.ngrok-free.app/api/call",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to make call");
    }

    const data = await response.json();
    console.log("✅ Call initiated successfully:", data);
    return data;
  } catch (error) {
    console.error("❌ Error making call:", error);
    throw error;
  }
}
