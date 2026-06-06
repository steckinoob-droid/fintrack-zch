import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size   = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: 32,
        height: 32,
        background: "#0A0E1A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          background: "#10B981",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF",
          fontSize: 15,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        F
      </div>
    </div>,
    { width: 32, height: 32 }
  );
}
