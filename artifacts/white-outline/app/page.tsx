"use client";

import {
  ChangeEvent,
  DragEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  computeAlphaDistanceField,
  extractAlpha,
  hexToRgb,
  loadImage,
  makeOutlineImageData,
} from "./lib/image-processing";

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DEFAULT_OUTLINE_SIZE = 15;

type ProcessedImage = {
  originalUrl: string;
  subjectUrl: string;
  fileName: string;
  width: number;
  height: number;
  distanceField: Float32Array;
  model: string;
  predictionId: string;
};

type RemoveBackgroundResponse = {
  transparentPngDataUrl: string;
  model: string;
  predictionId: string;
};

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

async function removeBackground(file: File) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("/api/remove-background", {
    method: "POST",
    body: formData,
  });

  const body = (await response.json()) as Partial<RemoveBackgroundResponse> & {
    error?: string;
    details?: string;
  };

  if (!response.ok || !body.transparentPngDataUrl) {
    throw new Error(
      [body.error, body.details].filter(Boolean).join(" ") ||
        "Background removal failed.",
    );
  }

  return body as RemoveBackgroundResponse;
}

async function buildProcessedImage(
  file: File,
  apiResult: RemoveBackgroundResponse,
): Promise<ProcessedImage> {
  const originalUrl = URL.createObjectURL(file);
  const subjectUrl = apiResult.transparentPngDataUrl;
  const [original, subject] = await Promise.all([
    loadImage(originalUrl),
    loadImage(subjectUrl),
  ]);

  if (
    original.naturalWidth !== subject.naturalWidth ||
    original.naturalHeight !== subject.naturalHeight
  ) {
    URL.revokeObjectURL(originalUrl);
    throw new Error(
      `The extracted PNG dimensions (${subject.naturalWidth}×${subject.naturalHeight}) do not match the original (${original.naturalWidth}×${original.naturalHeight}), so exact layer alignment cannot be guaranteed. Try another image or Replicate model.`,
    );
  }

  const canvas = document.createElement("canvas");
  canvas.width = subject.naturalWidth;
  canvas.height = subject.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context)
    throw new Error("Your browser could not initialize image processing.");

  context.drawImage(subject, 0, 0);
  const subjectPixels = context.getImageData(0, 0, canvas.width, canvas.height);
  const alpha = extractAlpha(subjectPixels);
  const distanceField = computeAlphaDistanceField(
    alpha,
    canvas.width,
    canvas.height,
  );

  return {
    originalUrl,
    subjectUrl,
    fileName: file.name,
    width: canvas.width,
    height: canvas.height,
    distanceField,
    model: apiResult.model,
    predictionId: apiResult.predictionId,
  };
}

export default function Home() {
  const [processed, setProcessed] = useState<ProcessedImage | null>(null);
  const [outlineColor, setOutlineColor] = useState("#ffffff");
  const [outlineSize, setOutlineSize] = useState(DEFAULT_OUTLINE_SIZE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Upload an image to begin.");
  const [previewMode, setPreviewMode] = useState<"side-by-side" | "split">(
    "side-by-side",
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const outlineImageUrl = useMemo(() => {
    if (!processed) return null;

    const canvas = document.createElement("canvas");
    canvas.width = processed.width;
    canvas.height = processed.height;
    const context = canvas.getContext("2d");
    if (!context) return null;

    const outline = makeOutlineImageData(
      processed.distanceField,
      processed.width,
      processed.height,
      outlineSize,
      hexToRgb(outlineColor),
    );
    context.putImageData(outline, 0, 0);
    return canvas.toDataURL("image/png");
  }, [outlineColor, outlineSize, processed]);

  const validateFile = useCallback((file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      throw new Error("Please upload a JPG, JPEG, PNG, or WEBP image.");
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(
        `The file is ${formatBytes(file.size)}. Upload an image smaller than 20 MB.`,
      );
    }
  }, []);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      validateFile(file);
      setIsProcessing(true);
      setStatus("Uploading image to Replicate...");

      try {
        if (processed?.originalUrl) URL.revokeObjectURL(processed.originalUrl);
        setProcessed(null);
        setOutlineColor("#ffffff");
        setOutlineSize(DEFAULT_OUTLINE_SIZE);

        const apiResult = await removeBackground(file);
        setStatus(
          "Generating locked outline mask from the transparent subject...",
        );
        const result = await buildProcessedImage(file, apiResult);
        setProcessed(result);
        setStatus(
          "Done. Adjust the outline color or thickness live, then download your PNG.",
        );
      } catch (caught) {
        setError(getErrorMessage(caught));
        setStatus("Upload an image to try again.");
      } finally {
        setIsProcessing(false);
      }
    },
    [processed?.originalUrl, validateFile],
  );

  const onFileInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleFile(file);
    event.target.value = "";
  };

  const onDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await handleFile(file);
  };

  const downloadPng = useCallback(async () => {
    if (!processed || !outlineImageUrl) return;

    const [original, outline, subject] = await Promise.all([
      loadImage(processed.originalUrl),
      loadImage(outlineImageUrl),
      loadImage(processed.subjectUrl),
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = processed.width;
    canvas.height = processed.height;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.drawImage(original, 0, 0);
    context.drawImage(outline, 0, 0);
    context.drawImage(subject, 0, 0);

    const link = document.createElement("a");
    const safeName = processed.fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-_]+/gi, "-");
    link.href = canvas.toDataURL("image/png");
    link.download = `${safeName || "outlined-image"}-white-outline.png`;
    link.click();
  }, [outlineImageUrl, processed]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div className="space-y-6 py-6">
          <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 shadow-2xl backdrop-blur">
            AI background removal + real mask dilation outline
          </div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">
              Photoshop-style white outlines for thumbnails and stickers.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-300">
              Upload once. Replicate extracts a transparent PNG, the app expands
              the subject mask into a locked outline layer, and the final export
              keeps all three layers perfectly aligned.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm text-slate-300">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <strong className="block text-white">Layer 1</strong>
              Original image
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <strong className="block text-white">Layer 2</strong>
              Mask outline
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <strong className="block text-white">Layer 3</strong>
              Cutout subject
            </div>
          </div>
        </div>

        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          className="group flex min-h-[22rem] cursor-pointer flex-col items-center justify-center rounded-[2rem] border border-dashed border-white/20 bg-white/[0.06] p-8 text-center shadow-2xl backdrop-blur transition hover:border-blue-300/70 hover:bg-white/[0.09]"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onFileInputChange}
            disabled={isProcessing}
          />
          <div className="mb-5 rounded-3xl bg-blue-500/15 p-5 text-4xl ring-1 ring-blue-300/20">
            ✨
          </div>
          <h2 className="text-2xl font-bold text-white">Drop an image here</h2>
          <p className="mt-2 max-w-md text-slate-300">
            or click to upload JPG, JPEG, PNG, or WEBP up to 20 MB.
          </p>
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => fileInputRef.current?.click()}
            className="mt-6 rounded-full bg-white px-6 py-3 font-bold text-slate-950 transition hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isProcessing ? "Processing..." : "Choose image"}
          </button>
          <p className="mt-5 text-sm text-slate-400">{status}</p>
        </label>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-100">
          <strong>Could not generate outline.</strong> {error}
        </div>
      ) : null}

      {isProcessing ? (
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-8 shadow-2xl">
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-blue-400 to-rose-400" />
          </div>
          <p className="mt-4 text-slate-300">
            Waiting for Replicate, then calculating the subject distance field
            for live outline edits.
          </p>
        </div>
      ) : null}

      {processed && outlineImageUrl ? (
        <section className="grid gap-6 lg:grid-cols-[18rem_1fr]">
          <aside className="h-fit rounded-[2rem] border border-white/10 bg-white/[0.07] p-5 shadow-2xl backdrop-blur">
            <h2 className="text-xl font-bold text-white">Outline controls</h2>
            <p className="mt-1 text-sm text-slate-400">
              Controls unlock only after AI processing is complete.
            </p>

            <div className="mt-6 space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-200">
                  Outline color
                </span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={outlineColor}
                    onChange={(event) => setOutlineColor(event.target.value)}
                    className="h-12 w-16 cursor-pointer rounded-xl border border-white/10 bg-transparent p-1"
                  />
                  <input
                    value={outlineColor}
                    onChange={(event) => setOutlineColor(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3 py-3 text-sm text-white outline-none ring-blue-400/40 focus:ring-2"
                  />
                </div>
              </label>

              <label className="block space-y-2">
                <span className="flex justify-between text-sm font-semibold text-slate-200">
                  <span>Outline size</span>
                  <span>{outlineSize}px</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={outlineSize}
                  onChange={(event) =>
                    setOutlineSize(Number(event.target.value))
                  }
                  className="w-full accent-blue-400"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                {[
                  ["White", "#ffffff"],
                  ["Black", "#050505"],
                  ["Yellow", "#fde047"],
                  ["Red", "#ef4444"],
                  ["Blue", "#3b82f6"],
                  ["Green", "#22c55e"],
                ].map(([label, color]) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setOutlineColor(color)}
                    className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={downloadPng}
                className="w-full rounded-2xl bg-gradient-to-r from-blue-400 to-rose-400 px-4 py-3 font-black text-white shadow-lg shadow-blue-950/40 transition hover:scale-[1.02]"
              >
                Download PNG
              </button>
            </div>

            <dl className="mt-6 space-y-2 border-t border-white/10 pt-5 text-xs text-slate-400">
              <div className="flex justify-between gap-3">
                <dt>Dimensions</dt>
                <dd>
                  {processed.width}×{processed.height}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Model</dt>
                <dd className="truncate">{processed.model}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Prediction</dt>
                <dd className="truncate">{processed.predictionId}</dd>
              </div>
            </dl>
          </aside>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl backdrop-blur">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Before / After preview
                </h2>
                <p className="text-sm text-slate-400">
                  No layer can be moved. Every image is drawn at 0,0 on the
                  original canvas.
                </p>
              </div>
              <div className="flex rounded-full border border-white/10 bg-slate-950/50 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setPreviewMode("side-by-side")}
                  className={`rounded-full px-4 py-2 ${previewMode === "side-by-side" ? "bg-white text-slate-950" : "text-slate-300"}`}
                >
                  Side-by-side
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode("split")}
                  className={`rounded-full px-4 py-2 ${previewMode === "split" ? "bg-white text-slate-950" : "text-slate-300"}`}
                >
                  Split
                </button>
              </div>
            </div>

            {previewMode === "side-by-side" ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <PreviewCard
                  title="Before"
                  width={processed.width}
                  height={processed.height}
                >
                  <img
                    src={processed.originalUrl}
                    alt="Original uploaded image"
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                </PreviewCard>
                <PreviewCard
                  title="After"
                  width={processed.width}
                  height={processed.height}
                  checkerboard
                >
                  <img
                    src={processed.originalUrl}
                    alt="Original layer"
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                  <img
                    src={outlineImageUrl}
                    alt="Generated outline layer"
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                  <img
                    src={processed.subjectUrl}
                    alt="Transparent subject layer"
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                </PreviewCard>
              </div>
            ) : (
              <PreviewCard
                title="Split comparison"
                width={processed.width}
                height={processed.height}
                checkerboard
              >
                <img
                  src={processed.originalUrl}
                  alt="Original image"
                  className="absolute inset-0 h-full w-full object-contain"
                />
                <div className="absolute inset-y-0 right-0 w-1/2 overflow-hidden border-l-2 border-white/80">
                  <div
                    className="absolute inset-y-0 right-0"
                    style={{ width: "200%" }}
                  >
                    <img
                      src={processed.originalUrl}
                      alt="Original layer"
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                    <img
                      src={outlineImageUrl}
                      alt="Outline layer"
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                    <img
                      src={processed.subjectUrl}
                      alt="Subject layer"
                      className="absolute inset-0 h-full w-full object-contain"
                    />
                  </div>
                </div>
              </PreviewCard>
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}

function PreviewCard({
  title,
  width,
  height,
  checkerboard = false,
  children,
}: Readonly<{
  title: string;
  width: number;
  height: number;
  checkerboard?: boolean;
  children: React.ReactNode;
}>) {
  return (
    <figure className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-slate-950/60">
      <figcaption className="border-b border-white/10 px-4 py-3 text-sm font-bold text-slate-200">
        {title}
      </figcaption>
      <div
        className={`relative ${checkerboard ? "checkerboard" : "bg-slate-950"}`}
      >
        <div
          className="relative mx-auto max-h-[70vh] w-full"
          style={{ aspectRatio: `${width} / ${height}` }}
        >
          {children}
        </div>
      </div>
    </figure>
  );
}
