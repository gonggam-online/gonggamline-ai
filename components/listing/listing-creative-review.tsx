import Image from "next/image";
import type { ListingCreativeReviewPacket } from "@/shared/domain/listing-creative";

export function ListingCreativeReview({ packet }: { packet: ListingCreativeReviewPacket }) {
  return (
    <section className="panel" aria-labelledby="creative-preview-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">ACTUAL-BYTE FIXTURE RENDER REVIEW</p>
          <h2 id="creative-preview-heading">두 개의 creative 후보 미리보기</h2>
        </div>
        <span className="status-badge status-pending">{packet.conversionReadiness}</span>
      </div>
      <p className="panel-help">
        아래 PNG는 실제 바이트로 렌더·디코드·해시·크기 검증된 합성 fixture입니다.
        상품 이미지가 아니며 WING 등록 자산으로 사용할 수 없습니다.
      </p>
      <div className="attribute-list" style={{ maxHeight: "none", overflow: "visible" }}>
        {packet.candidates.map((candidate) => (
          <article className="attribute-card" key={candidate.candidateSetId}>
            <strong>{candidate.label} · {candidate.candidateSetId}</strong>
            <p>{candidate.rationale.join(" · ")} · confidence {candidate.confidence}</p>
            <p>
              title {candidate.titleCandidateId} · keywords {candidate.keywordCandidateId} ·
              source {candidate.renderJobs.every(({ inputSources }) => inputSources.length === 0)
                ? "독립 fact-only synthetic (제3자 pixel 입력 없음)"
                : "권리 capability 검토 필요"}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
              {candidate.artifacts.map((artifact) => (
                <figure key={artifact.artifactId} style={{ margin: 0 }}>
                  <Image
                    src={artifact.previewDataUrl}
                    alt={artifact.altText}
                    width={artifact.width}
                    height={artifact.height}
                    unoptimized
                    style={{ width: "100%", height: "auto", borderRadius: 12, border: "1px solid #d8dee9" }}
                  />
                  <figcaption style={{ overflowWrap: "anywhere", fontSize: 12, marginTop: 8 }}>
                    {artifact.role} · {artifact.width}×{artifact.height} · {artifact.mimeType}<br />
                    digest {artifact.byteDigest}<br />
                    {artifact.deployability} · QA {Object.values(artifact.review).filter((value) => value === "PASS").length}/7<br />
                    provider {artifact.providerId} · {artifact.providerModelVersion}
                  </figcaption>
                </figure>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="attribute-list" style={{ maxHeight: "none", overflow: "visible" }}>
        {packet.issues.map((entry) => (
          <article className="attribute-card" key={`${entry.code}:${entry.path}`}>
            <strong style={{ overflowWrap: "anywhere" }}>{entry.severity} · {entry.code}</strong>
            <p><code>{entry.path}</code> · {entry.message}</p>
          </article>
        ))}
      </div>
      <p>
        <strong>콘텐츠 승인:</strong> {packet.contentApproval.approved ? "승인" : "미승인"} ·{" "}
        <strong>live-write 승인:</strong> {packet.liveWriteApproval.approved ? "승인" : "별도 승인 필요"}
      </p>
      <p style={{ overflowWrap: "anywhere" }}>
        evidence {packet.evidenceEvaluationId} · policy {packet.policyDigest} · category {packet.categoryMetadataDigest} · revision {packet.revisionId}
      </p>
    </section>
  );
}
