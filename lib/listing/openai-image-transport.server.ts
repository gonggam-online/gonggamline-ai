import "server-only";

import OpenAI, { toFile } from "openai";

import type {
  OpenAiListingImageTransport,
  OpenAiListingImageTransportRequest,
  OpenAiListingImageTransportResponse,
  OpenAiListingImageUsage,
} from "@/engines/listing/openai-image-provider";
import { OpenAiListingImageError } from "@/engines/listing/openai-image-provider";

function usageFromResponse(
  usage: Readonly<{
    input_tokens?: number;
    input_tokens_details?: Readonly<{ image_tokens?: number; text_tokens?: number }>;
    output_tokens?: number;
    total_tokens?: number;
  }> | undefined,
): OpenAiListingImageUsage {
  return {
    inputTextTokens: usage?.input_tokens_details?.text_tokens ?? null,
    inputImageTokens: usage?.input_tokens_details?.image_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null,
  };
}

function extension(mimeType: "image/png" | "image/jpeg" | "image/webp"): string {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

export class OpenAiSdkListingImageTransport implements OpenAiListingImageTransport {
  constructor(private readonly client: OpenAI) {}

  async execute(
    request: OpenAiListingImageTransportRequest,
  ): Promise<OpenAiListingImageTransportResponse> {
    const common = {
      model: request.model,
      prompt: request.prompt,
      size: request.size,
      quality: request.quality,
      output_format: request.outputFormat,
      background: "opaque" as const,
      n: 1,
    };
    const result = request.operation === "GENERATE"
      ? await this.client.images.generate(common, {
        idempotencyKey: request.idempotencyKey,
      }).withResponse()
      : await this.client.images.edit({
        ...common,
        input_fidelity: "high",
        image: await Promise.all(request.inputs.map((input, index) => toFile(
          input.bytes,
          `source-${index + 1}.${extension(input.mimeType)}`,
          { type: input.mimeType },
        ))),
      }, {
        idempotencyKey: request.idempotencyKey,
      }).withResponse();
    const image = result.data.data?.[0];
    if (!image?.b64_json || result.data.data?.length !== 1) {
      throw new OpenAiListingImageError("OPENAI_IMAGE_RESPONSE_INVALID");
    }
    return {
      b64Json: image.b64_json,
      providerRequestId: result.request_id,
      usage: usageFromResponse(result.data.usage),
    };
  }
}
