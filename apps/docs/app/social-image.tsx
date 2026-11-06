import { ImageResponse } from "next/og";

const imageSize = { width: 1200, height: 630 };

const CueMark = ({ size = 52 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <path
      d="M16 2v28M2 16h28M6.1 6.1l19.8 19.8m0-19.8L6.1 25.9"
      stroke="#315fd4"
      strokeLinecap="round"
      strokeWidth="2.7"
    />
  </svg>
);

const BranchStar = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="#ffd34f">
    <path d="m12 1.8 2.8 6.1 6.7.7-5 4.5 1.4 6.6-5.9-3.4-5.9 3.4 1.4-6.6-5-4.5 6.7-.7L12 1.8Z" />
  </svg>
);

export function createCueSocialImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        padding: "64px",
        background: "#f8f9fc",
        color: "#101318",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "56px",
        }}
      >
        <div
          style={{
            width: "440px",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "40px" }}>
            <CueMark />
            <span style={{ fontSize: "36px", fontWeight: 700, letterSpacing: "-1.5px" }}>Cue</span>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: "60px",
              lineHeight: 1.02,
              fontWeight: 700,
              letterSpacing: "-3px",
            }}
          >
            <span>IDE-style</span>
            <span>autocomplete</span>
            <span
              style={{
                alignSelf: "flex-start",
                background: "linear-gradient(transparent 66%, #f6d86f 66%)",
              }}
            >
              for Terminal.
            </span>
          </div>
          <div style={{ display: "flex", fontSize: "17px", color: "#58616e", marginTop: "24px" }}>
            Free and open source · Apple Terminal · VS Code
          </div>
        </div>

        <div
          style={{
            flex: 1,
            height: "370px",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: "16px",
            background: "#1e1e1e",
            boxShadow: "0 28px 70px rgba(31, 48, 81, 0.18)",
            border: "1px solid #383a3e",
          }}
        >
          <div
            style={{
              height: "46px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 18px",
              background: "#292929",
              borderBottom: "1px solid #3b3b3b",
            }}
          >
            <div style={{ display: "flex", gap: "7px" }}>
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#f26b5e",
                }}
              />
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#f5c451",
                }}
              />
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: "#58bd68",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                color: "#d6d9df",
                fontSize: "15px",
              }}
            >
              <CueMark size={16} />
              <span>Cue</span>
            </div>
            <span style={{ width: "42px" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", padding: "36px 30px", flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                color: "#d9dce2",
                fontSize: "20px",
                fontFamily: "monospace",
              }}
            >
              <span style={{ color: "#8aa6ff" }}>lele@cue</span>
              <span style={{ color: "#8c9097", marginLeft: "12px" }}>~/work/project %</span>
              <span style={{ marginLeft: "12px", fontWeight: 700 }}>git c</span>
              <span
                style={{ width: "11px", height: "25px", background: "#bec4ca", marginLeft: "7px" }}
              />
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                width: "400px",
                marginTop: "24px",
                marginLeft: "105px",
                padding: "8px",
                borderRadius: "10px",
                background: "#303033",
                border: "1px solid #4a4a4d",
                color: "#e2e3e6",
                fontFamily: "monospace",
                fontSize: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  minHeight: "42px",
                  padding: "0 12px",
                  borderRadius: "6px",
                  background: "#315fd4",
                  color: "white",
                  fontWeight: 700,
                }}
              >
                <BranchStar />
                <span>checkout</span>
                <span style={{ color: "#c3d2ff", fontWeight: 400 }}>
                  [branch, file, tag or commit]
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  minHeight: "38px",
                  padding: "0 12px",
                }}
              >
                <span style={{ color: "#ad78f0", fontSize: "19px" }}>$</span>
                <span>cherry-pick</span>
                <span style={{ color: "#a0a3aa" }}>&lt;commit&gt;</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  minHeight: "38px",
                  padding: "0 12px",
                }}
              >
                <span style={{ color: "#ad78f0", fontSize: "19px" }}>$</span>
                <span>commit -m &quot;message&quot;</span>
              </div>
              <div style={{ height: "1px", background: "#4a4a4d", margin: "4px 0" }} />
              <div
                style={{
                  display: "flex",
                  color: "#c2c3c7",
                  fontSize: "14px",
                  fontStyle: "italic",
                  padding: "4px 8px",
                }}
              >
                Switch branches or restore working tree files
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    { ...imageSize },
  );
}
