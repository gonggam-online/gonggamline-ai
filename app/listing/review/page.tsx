import Link from "next/link";
import { ListingCreativeReview } from "@/components/listing/listing-creative-review";
import { buildFixtureCreativeReviewPacket } from "@/engines/listing/creative-planner";

export default async function ListingReviewPage() {
  const creativePacket = await buildFixtureCreativeReviewPacket({
    packetId: "listing-review-synthetic-fixture",
    subjectReference: "synthetic-review-subject",
    provenFactIds: ["fixture:identity", "fixture:dimensions", "fixture:material"],
    factualConstraints: [
      "factId=fixture:identity; field=productName; value=합성 검토 상품",
      "factId=fixture:dimensions; field=dimensions; value=12 × 5 × 8 cm",
      "factId=fixture:material; field=material; value=폴리에스터",
    ],
    evidenceEvaluationId: "fixture:evidence-evaluation-v1",
    policyDigest: "fixture:policy-digest-v1",
    categoryMetadataDigest: "fixture:category-metadata-digest-v1",
    revisionId: "listing-review-synthetic-fixture:revision-1",
  });

  return (
    <main className="dashboard">
      <section className="hero" style={{ background: "linear-gradient(135deg,#123047,#0f766e)" }}>
        <div>
          <p className="eyebrow">LISTING CONTENT REVIEW</p>
          <h1>증거 기반 Listing 검토</h1>
          <p className="hero-description">
            등록 적합성과 전환 준비도를 분리하고, 실제 artifact digest에 결합된 한 후보만 승인하도록 검토합니다.
          </p>
        </div>
        <div className="hero-actions">
          <Link className="button-link secondary-button" href="/listing">Listing 초안으로 돌아가기</Link>
        </div>
      </section>

      <section className="stat-grid">
        <article><span>Registration readiness</span><strong>{creativePacket.registrationReadiness}</strong></article>
        <article><span>Conversion readiness</span><strong>{creativePacket.conversionReadiness}</strong></article>
        <article><span>Creative candidates</span><strong>{creativePacket.candidates.length}</strong></article>
        <article><span>Live publish</span><strong>SEPARATE APPROVAL</strong></article>
      </section>

      <section className="panel">
        <h2>BLOCKER / WARNING / OPTIMIZATION_PENDING / DERIVATIVE_UNAVAILABLE</h2>
        <p>
          최소 등록 패킷의 법·카테고리·핵심 사실·권리·payload 문제와 전환 최적화 부족을 서로 다른 상태로 표시합니다.
        </p>
      </section>

      <ListingCreativeReview packet={creativePacket} />

      <section className="panel">
        <h2>현재 durable-state 경계</h2>
        <p>
          이 페이지의 PNG는 요청 시 메모리에서 다시 생성되는 비배포 fixture입니다. 실제 상품 asset,
          immutable revision, content approval 및 learning 기록은 승인된 관리형 object storage와
          Database/Auth/RLS Story가 마련되기 전까지 영구 저장하지 않습니다.
        </p>
      </section>
    </main>
  );
}
