interface Env {
  BUCKET: R2Bucket;
  UPLOAD_API_KEY: string;
  AI: Ai;
}

interface DetectionResult {
  score: number;
  label: string;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

const PERSON_CONFIDENCE_THRESHOLD = 0.3;

const ALLOWED_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function corsHeaders(origin: string | null): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Upload-Api-Key",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin: string | null
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

function isAuthorized(request: Request, env: Env): boolean {
  const key = request.headers.get("X-Upload-Api-Key");
  return typeof key === "string" && key === env.UPLOAD_API_KEY;
}

function getObjectKey(url: URL): string | null {
  const key = url.pathname.slice(1);
  return key.length > 0 ? key : null;
}

async function validateHumanImage(
  env: Env,
  imageBytes: ArrayBuffer
): Promise<boolean> {
  try {
    const results = (await env.AI.run("@cf/facebook/detr-resnet-50", {
      image: [...new Uint8Array(imageBytes)],
    })) as DetectionResult[];

    return results.some(
      (d) => d.label === "person" && d.score >= PERSON_CONFIDENCE_THRESHOLD
    );
  } catch (err) {
    console.error("Workers AI detection failed:", err);
    return true;
  }
}

async function handleGet(
  request: Request,
  env: Env,
  key: string,
  origin: string | null
): Promise<Response> {
  const object = await env.BUCKET.get(key);

  if (!object) {
    return jsonResponse({ error: "Not Found" }, 404, origin);
  }

  const headers = new Headers(corsHeaders(origin));
  headers.set(
    "Content-Type",
    object.httpMetadata?.contentType ?? "application/octet-stream"
  );
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", object.httpEtag);

  const ifNoneMatch = request.headers.get("If-None-Match");
  if (ifNoneMatch && ifNoneMatch === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(object.body, { status: 200, headers });
}

async function handlePut(
  request: Request,
  env: Env,
  key: string,
  origin: string | null
): Promise<Response> {
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401, origin);
  }

  const contentType = request.headers.get("Content-Type") ?? "";
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return jsonResponse(
      { error: "Unsupported content type. Allowed: jpeg, png, webp." },
      400,
      origin
    );
  }

  const contentLength = parseInt(
    request.headers.get("Content-Length") ?? "0",
    10
  );
  if (contentLength > MAX_SIZE_BYTES) {
    return jsonResponse(
      { error: "File too large. Maximum size is 5 MB." },
      413,
      origin
    );
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_SIZE_BYTES) {
    return jsonResponse(
      { error: "File too large. Maximum size is 5 MB." },
      413,
      origin
    );
  }

  const humanDetected = await validateHumanImage(env, body);
  if (!humanDetected) {
    return jsonResponse(
      {
        error: "No human detected in the uploaded image. Please upload a clear photo of yourself.",
      },
      400,
      origin
    );
  }

  await env.BUCKET.put(key, body, {
    httpMetadata: { contentType },
  });

  return jsonResponse({ ok: true, key }, 200, origin);
}

async function handleDelete(
  request: Request,
  env: Env,
  key: string,
  origin: string | null
): Promise<Response> {
  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401, origin);
  }

  await env.BUCKET.delete(key);

  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export default {
  async fetch(
    request: Request,
    env: Env
  ): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin),
      });
    }

    const key = getObjectKey(url);
    if (!key) {
      return jsonResponse({ error: "Missing object key" }, 400, origin);
    }

    switch (request.method) {
      case "GET":
        return handleGet(request, env, key, origin);
      case "PUT":
        return handlePut(request, env, key, origin);
      case "DELETE":
        return handleDelete(request, env, key, origin);
      default:
        return jsonResponse({ error: "Method Not Allowed" }, 405, origin);
    }
  },
} satisfies ExportedHandler<Env>;
