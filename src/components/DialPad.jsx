import React from "react";

const DialPad = ({
  isCalling,
  status,
  callStatus,
  country,
  countries,
  setCountry,
  phoneNumber,
  handleDigitPress,
  isSystemOk,
  makeCall,
  handleDelete,
  handleClear,
  endCall,
  error,
  isMuted,
  toggleMute,
}) => {
  const dialPadKeys = [
    { num: "1", text: "" },
    { num: "2", text: "ABC" },
    { num: "3", text: "DEF" },
    { num: "4", text: "GHI" },
    { num: "5", text: "JKL" },
    { num: "6", text: "MNO" },
    { num: "7", text: "PQRS" },
    { num: "8", text: "TUV" },
    { num: "9", text: "WXYZ" },
    { num: "*", text: "" },
    { num: "0", text: "+" },
    { num: "#", text: "" },
  ];

  return (
    <div
      className="card border-0 shadow-lg"
      style={{
        width: "380px",
        borderRadius: "24px",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(20px)",
        transition: "all 0.3s ease",
      }}
    >
      <div className="card-body p-4">
        {/* Header */}
        <div className="text-center mb-4">
          <div
            className="d-inline-flex align-items-center justify-content-center mb-3"
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            }}
          >
            <i className="bi bi-telephone-fill text-white fs-3"></i>
          </div>
          <h4 className="fw-bold mb-2" style={{ color: "#1a1a2e" }}>
            VoIP Call
          </h4>
          <div
            className="badge px-3 py-2"
            style={{
              background: isCalling
                ? "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
                : "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
              fontSize: "12px",
              borderRadius: "12px",
              border: "none",
            }}
          >
            {callStatus || status}
          </div>
        </div>

        {/* Country Selector */}
        {!isCalling && (
          <div className="mb-3">
            <select
              className="form-select border-0 shadow-sm"
              style={{
                borderRadius: "12px",
                padding: "12px 16px",
                fontSize: "15px",
                background: "#f8f9fa",
              }}
              value={country.code}
              onChange={(e) => {
                const selected = countries.find(
                  (c) => c.code === e.target.value
                );
                setCountry(selected);
              }}
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.dial_code})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Phone Number Display */}
        <div
          className="text-center mb-4 p-3"
          style={{
            background: "#f8f9fa",
            borderRadius: "16px",
            minHeight: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {phoneNumber ? (
            <div className="fs-4 fw-bold" style={{ color: "#1a1a2e" }}>
              <span style={{ color: "#667eea" }}>{country.dial_code}</span>{" "}
              {phoneNumber}
            </div>
          ) : (
            <span className="text-muted">Enter number</span>
          )}
        </div>

        {/* Dial Pad */}
        <div className="mb-4">
          <div className="row row-cols-3 g-2">
            {dialPadKeys.map((key) => (
              <div className="col" key={key.num}>
                <button
                  className="btn w-100 border-0 shadow-sm position-relative"
                  style={{
                    height: "70px",
                    borderRadius: "16px",
                    background: "white",
                    transition: "all 0.2s ease",
                    fontSize: "24px",
                    fontWeight: "600",
                    color: "#1a1a2e",
                  }}
                  onClick={() => handleDigitPress(key.num)}
                  disabled={isCalling}
                  onMouseEnter={(e) => {
                    if (!isCalling) {
                      e.currentTarget.style.background =
                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)";
                      e.currentTarget.style.color = "white";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCalling) {
                      e.currentTarget.style.background = "white";
                      e.currentTarget.style.color = "#1a1a2e";
                      e.currentTarget.style.transform = "translateY(0)";
                    }
                  }}
                >
                  <div>{key.num}</div>
                  {key.text && (
                    <small
                      style={{
                        position: "absolute",
                        bottom: "8px",
                        left: 0,
                        right: 0,
                        fontSize: "10px",
                        opacity: 0.6,
                      }}
                    >
                      {key.text}
                    </small>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="d-flex justify-content-center gap-3">
          {!isCalling ? (
            <>
              {/* Call, Delete, Clear buttons */}
              <button
                className="btn border-0 shadow"
                disabled={!isSystemOk || !phoneNumber}
                onClick={makeCall}
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
                  color: "white",
                  fontSize: "24px",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  if (isSystemOk && phoneNumber) {
                    e.currentTarget.style.transform = "scale(1.1)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <i className="bi bi-telephone-fill"></i>
              </button>
              <button
                className="btn border-0 shadow"
                onClick={handleDelete}
                disabled={!phoneNumber}
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "#f8f9fa",
                  color: "#1a1a2e",
                  fontSize: "20px",
                }}
              >
                <i className="bi bi-backspace"></i>
              </button>
              <button
                className="btn border-0 shadow"
                onClick={handleClear}
                disabled={!phoneNumber}
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: "#f8f9fa",
                  color: "#1a1a2e",
                  fontSize: "20px",
                }}
              >
                <i className="bi bi-x-lg"></i>
              </button>
            </>
          ) : (
            <>
              {/* ✅ Mute/Unmute Button */}
              <button
                className="btn border-0 shadow"
                onClick={toggleMute}
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: isMuted
                    ? "linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)"
                    : "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                  color: "white",
                  fontSize: "20px",
                  transition: "all 0.3s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                }}
              >
                <i
                  className={`bi ${
                    isMuted ? "bi-mic-mute-fill" : "bi-mic-fill"
                  }`}
                ></i>
              </button>

              {/* End Call Button */}
              <button
                className="btn border-0 shadow"
                onClick={endCall}
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background:
                    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                  color: "white",
                  fontSize: "24px",
                }}
              >
                <i className="bi bi-telephone-x-fill"></i>
              </button>
            </>
          )}
        </div>

        {error && (
          <div
            className="alert mt-3 border-0"
            style={{
              background: "rgba(239, 83, 80, 0.1)",
              color: "#d32f2f",
              borderRadius: "12px",
            }}
          >
            <i className="bi bi-exclamation-circle me-2"></i>
            {error.message || "Error initializing client"}
          </div>
        )}
      </div>
    </div>
  );
};

export default DialPad;
