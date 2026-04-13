import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* 배경 장식 원 — 각각 단독 자식이므로 display 불필요하지만 flex 명시 */}
        <div
          style={{
            position: "absolute",
            top: "-80px",
            right: "-80px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-60px",
            left: "-60px",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* AI 플랫폼 배지 — map 대신 명시적 나열 */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: "12px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              background: "rgba(99,102,241,0.2)",
              border: "1px solid rgba(99,102,241,0.4)",
              borderRadius: "20px",
              padding: "6px 14px",
              color: "#a5b4fc",
              fontSize: "20px",
              display: "flex",
            }}
          >
            ChatGPT
          </div>
          <div
            style={{
              background: "rgba(99,102,241,0.2)",
              border: "1px solid rgba(99,102,241,0.4)",
              borderRadius: "20px",
              padding: "6px 14px",
              color: "#a5b4fc",
              fontSize: "20px",
              display: "flex",
            }}
          >
            네이버 AI
          </div>
          <div
            style={{
              background: "rgba(99,102,241,0.2)",
              border: "1px solid rgba(99,102,241,0.4)",
              borderRadius: "20px",
              padding: "6px 14px",
              color: "#a5b4fc",
              fontSize: "20px",
              display: "flex",
            }}
          >
            Claude
          </div>
          <div
            style={{
              background: "rgba(99,102,241,0.2)",
              border: "1px solid rgba(99,102,241,0.4)",
              borderRadius: "20px",
              padding: "6px 14px",
              color: "#a5b4fc",
              fontSize: "20px",
              display: "flex",
            }}
          >
            Gemini
          </div>
          <div
            style={{
              background: "rgba(99,102,241,0.2)",
              border: "1px solid rgba(99,102,241,0.4)",
              borderRadius: "20px",
              padding: "6px 14px",
              color: "#a5b4fc",
              fontSize: "20px",
              display: "flex",
            }}
          >
            Perplexity
          </div>
        </div>

        {/* 서비스명 */}
        <div
          style={{
            fontSize: "90px",
            fontWeight: "900",
            color: "#ffffff",
            letterSpacing: "-2px",
            lineHeight: "1",
            marginBottom: "20px",
            display: "flex",
          }}
        >
          AEOlab
        </div>

        {/* 부제 */}
        <div
          style={{
            fontSize: "40px",
            fontWeight: "400",
            color: "#cbd5e1",
            marginBottom: "32px",
            display: "flex",
          }}
        >
          AI 검색 노출 분석 플랫폼
        </div>

        {/* 설명 */}
        <div
          style={{
            fontSize: "26px",
            color: "#94a3b8",
            textAlign: "center",
            maxWidth: "800px",
            lineHeight: "1.5",
            marginBottom: "48px",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          네이버·카카오·ChatGPT 3채널 노출 여부 자동 진단 · 경쟁사 벤치마킹 · 개선 가이드
        </div>

        {/* 도메인 */}
        <div
          style={{
            fontSize: "24px",
            fontWeight: "600",
            color: "#6366f1",
            letterSpacing: "1px",
            background: "rgba(99,102,241,0.1)",
            border: "1px solid rgba(99,102,241,0.3)",
            borderRadius: "8px",
            padding: "10px 24px",
            display: "flex",
          }}
        >
          aeolab.co.kr
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
