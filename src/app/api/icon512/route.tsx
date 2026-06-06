import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        width: 512,
        height: 512,
        background: "#0A0E1A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 320,
          height: 320,
          background: "#10B981",
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#FFFFFF",
          fontSize: 210,
          fontWeight: 800,
          fontFamily: "sans-serif",
        }}
      >
        F
      </div>
    </div>,
    { width: 512, height: 512 }
  );
}
