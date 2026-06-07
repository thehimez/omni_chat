import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const SUPPORTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DEFAULT_MODEL = "bria/remove-background";
const REPLICATE_API_BASE = "https://api.replicate.com/v1";

type ReplicatePrediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: unknown;
  error?: unknown;
  urls?: {
    get?: string;
    cancel?: string;
  };
};

type ApiError = {
  error: string;
  details?: string;
  retryable?: boolean;
};

function jsonError(status: number, body: ApiError) {
  return NextResponse.json(body, { status });
}

function getOutputUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const firstUrl = output.find((value) => typeof value === "string");
    return typeof firstUrl === "string" ? firstUrl : null;
  }
  if (output && typeof output === "object") {
    const values = Object.values(output as Record<string, unknown>);
    const firstUrl = values.find((value) => typeof value === "string");
    return typeof firstUrl === "string" ? firstUrl : null;
  }
  return null;
}

function getReplicateAuthHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function createPrediction(
  token: string,
  model: string,
  imageDataUri: string,
) {
  const response = await fetch(
    `${REPLICATE_API_BASE}/models/${model}/predictions`,
    {
      method: "POST",
      headers: getReplicateAuthHeaders(token),
      body: JSON.stringify({
        input: {
          image: imageDataUri,
        },
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Replicate rejected the image (${response.status}): ${message}`,
    );
  }

  return (await response.json()) as ReplicatePrediction;
}

async function pollPrediction(token: string, prediction: ReplicatePrediction) {
  const getUrl =
    prediction.urls?.get ??
    `${REPLICATE_API_BASE}/predictions/${prediction.id}`;
  let current = prediction;

  for (let attempt = 0; attempt < 75; attempt += 1) {
    if (["succeeded", "failed", "canceled"].includes(current.status)) {
      return current;
    }

    await sleep(attempt < 5 ? 900 : 1500);

    const response = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(
        `Could not read Replicate prediction (${response.status}): ${message}`,
      );
    }

    current = (await response.json()) as ReplicatePrediction;
  }

  throw new Error(
    "Replicate did not finish background removal before the timeout.",
  );
}

async function fetchOutputAsDataUrl(outputUrl: string) {
  const response = await fetch(outputUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Could not download transparent PNG from Replicate (${response.status}).`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "image/png";
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

export async function POST(request: NextRequest) {
  try {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token) {
      return jsonError(500, {
        error: "Replicate API token is not configured.",
        details:
          "Add REPLICATE_API_TOKEN to your environment and restart the Next.js server.",
      });
    }

    const formData = await request.formData();
    const file = formData.get("image");

    if (!(file instanceof File)) {
      return jsonError(400, {
        error: "Upload an image file using the `image` form field.",
      });
    }

    if (!SUPPORTED_TYPES.has(file.type)) {
      return jsonError(415, {
        error: "Unsupported file type. Use JPG, JPEG, PNG, or WEBP.",
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return jsonError(413, {
        error: "Image is too large. The maximum upload size is 20 MB.",
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const imageDataUri = `data:${file.type};base64,${buffer.toString("base64")}`;
    const model = process.env.REPLICATE_BACKGROUND_MODEL ?? DEFAULT_MODEL;

    const prediction = await createPrediction(token, model, imageDataUri);
    const completed = await pollPrediction(token, prediction);

    if (completed.status !== "succeeded") {
      return jsonError(502, {
        error: "Replicate could not remove the background.",
        details:
          typeof completed.error === "string"
            ? completed.error
            : JSON.stringify(completed.error ?? completed.status),
        retryable: completed.status !== "canceled",
      });
    }

    const outputUrl = getOutputUrl(completed.output);
    if (!outputUrl) {
      return jsonError(502, {
        error: "Replicate finished but did not return an image URL.",
        details: JSON.stringify(completed.output),
        retryable: true,
      });
    }

    const transparentPngDataUrl = await fetchOutputAsDataUrl(outputUrl);

    return NextResponse.json({
      transparentPngDataUrl,
      replicateOutputUrl: outputUrl,
      model,
      predictionId: completed.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return jsonError(500, {
      error: "Background removal failed.",
      details: message,
      retryable: true,
    });
  }
}
