export default function Home() {
  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "60px",
        fontFamily: "sans-serif",
      }}
    >
      <h1 style={{ fontSize: "42px", marginBottom: "20px" }}>
        🚀 공감라인 AI 상품발굴 시스템
      </h1>

      <p style={{ fontSize: "20px", color: "#555" }}>
        도매꾹 Open API와 AI를 활용하여
        쿠팡에서 판매할 상품을 자동으로 발굴하는 시스템입니다.
      </p>

      <hr style={{ margin: "40px 0" }} />

      <h2>주요 기능</h2>

      <ul style={{ fontSize: "18px", lineHeight: "2" }}>
        <li>📦 도매꾹 상품 자동 수집</li>
        <li>🤖 AI 상품 점수 계산</li>
        <li>📊 쿠팡 경쟁도 분석</li>
        <li>💰 예상 마진 계산</li>
        <li>🏆 발주 TOP10 추천</li>
      </ul>

      <hr style={{ margin: "40px 0" }} />

      <h2>개발 진행 현황</h2>

      <table
        border={1}
        cellPadding={10}
        style={{ borderCollapse: "collapse" }}
      >
        <tbody>
          <tr>
            <td>Next.js</td>
            <td>✅ 완료</td>
          </tr>

          <tr>
            <td>도매꾹 API</td>
            <td>🔄 개발 예정</td>
          </tr>

          <tr>
            <td>상품 DB</td>
            <td>🔄 개발 예정</td>
          </tr>

          <tr>
            <td>AI 분석</td>
            <td>🔄 개발 예정</td>
          </tr>

          <tr>
            <td>쿠팡 경쟁분석</td>
            <td>🔄 개발 예정</td>
          </tr>
        </tbody>
      </table>
    </main>
  );
}