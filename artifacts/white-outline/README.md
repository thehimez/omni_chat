# White Outline Generator

A Next.js App Router MVP for generating Photoshop-style subject outlines for thumbnails, stickers, DTF artwork, merchandise mockups, and social graphics.

## What it does

1. Uploads a JPG, JPEG, PNG, or WEBP image up to 20 MB.
2. Sends the image to Replicate for background removal.
3. Receives a transparent PNG subject cutout.
4. Builds an outline from the subject alpha mask using an image-processing distance field, not CSS borders.
5. Renders exactly three locked layers at the same origin: original image, outline, and subject cutout.
6. Exports a merged PNG containing all three layers.

## Environment

Copy `.env.example` to `.env.local` and set:

```bash
REPLICATE_API_TOKEN=r8_...
```

The default model is `bria/remove-background`, which is BRIA RMBG 2.0 on Replicate. It was chosen for soft alpha edges and strong subject cutout quality. You can swap models without changing code:

```bash
REPLICATE_BACKGROUND_MODEL=owner/model-name
```

## Development

```bash
pnpm install --filter @workspace/white-outline
pnpm --filter @workspace/white-outline dev
```
