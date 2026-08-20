import { expect, test } from "@playwright/test";
import { approveConversionDetailPagePacket, buildConversionDetailPagePacket } from "../../shared/domain/evidence-bound-conversion-detail-page";
import { buildConversionDetailPageFixtureInput } from "../fixtures/conversion-detail-page";

test("exact-bound 16B package renders at mobile and desktop without publish requests", async ({ page }) => {
  const reviewReady = buildConversionDetailPagePacket(buildConversionDetailPageFixtureInput());
  const packet = approveConversionDetailPagePacket(reviewReady, { approvalReference: "approval:16b-e2e", reviewerReference: "reviewer:owner", approvedAt: "2026-08-20T03:00:00.000Z", boundPacketDigest: reviewReady.digest });
  const writeRequests: string[] = [];
  page.on("request", (request) => { if (request.method() !== "GET") writeRequests.push(`${request.method()} ${request.url()}`); });
  await page.route("https://assets.invalid/**", async (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64") }));
  for (const viewport of [{ width: 360, height: 800 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.setContent(packet.html, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Synthetic fixture pouch");
    await expect(page.locator("main.detail section")).toHaveCount(9);
    const metrics = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, bodyFont: Number.parseFloat(getComputedStyle(document.body).fontSize), replacementCharacters: (document.body.textContent?.match(/�/g) ?? []).length, brokenImages: [...document.images].filter((image) => !image.complete || image.naturalWidth === 0).length }));
    expect(metrics).toEqual({ overflow: 0, bodyFont: 16, replacementCharacters: 0, brokenImages: 0 });
  }
  expect(packet.status).toBe("APPROVED_SHADOW");
  expect(packet.executionEligible).toBe(false);
  expect(packet.publicationAuthorized).toBe(false);
  expect(packet.listingSubmission).toBeNull();
  expect(writeRequests).toEqual([]);
});
