import React from "react";
import "bootstrap/dist/css/bootstrap.min.css";

export default function Dialer() {
  const keys = [
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

  const handleClick = (key) => {
    console.log("Pressed:", key);
  };

  return (
    <div className="container d-flex justify-content-center align-items-center vh-100">
      <div className="text-center">
        <div className="row row-cols-3 g-4">
          {keys.map((key, index) => (
            <div key={index} className="col">
              <button
                onClick={() => handleClick(key.num)}
                className="btn btn-light border rounded-circle shadow-sm"
                style={{
                  width: "80px",
                  height: "80px",
                  fontSize: "24px",
                  fontWeight: "500",
                  position: "relative",
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
                      fontSize: "12px",
                      color: "#555",
                    }}
                  >
                    {key.text}
                  </small>
                )}
              </button>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <button className="btn btn-success rounded-circle" style={{ width: "70px", height: "70px" }}>
            <i className="bi bi-telephone-fill" style={{ fontSize: "28px" }}></i>
          </button>
        </div>
      </div>
    </div>
  );
}
