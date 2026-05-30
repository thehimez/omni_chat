import { Router, type IRouter, type Request, type Response } from "express";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

const ALLOWED_HOSTNAME_SUFFIXES = [
  ".licdn.com",
  ".cdninstagram.com",
  ".fbcdn.net",
  ".whatsapp.net",
];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

router.get("/avatar-proxy", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const rawUrl = typeof req.query.url === "string" ? req.query.url : null;

  if (!rawUrl) {
    res.status(400).json({ error: "url required" });
    return;
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    res.status(400).json({ error: "invalid url" });
    return;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    res.status(400).json({ error: "only http/https urls are supported" });
    return;
  }

  if (!isAllowedHost(parsed.hostname)) {
    res.status(403).json({ error: "host not allowed" });
    return;
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; XandaBot/1.0)",
        "Accept": "image/webp,image/avif,image/*,*/*;q=0.8",
      },
    });

    if (!upstream.ok) {
      res.status(upstream.status).end();
      return;
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");

    const buffer = await upstream.arrayBuffer();
    res.end(Buffer.from(buffer));
  } catch {
    res.status(502).end();
  }
});

export default router;
