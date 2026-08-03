/**
 * Cloudflare Pages Function：把同源 `/api/*` 請求轉發到 `workers/api` 這個 Worker。
 *
 * 為什麼需要它（TASK-01）：
 * PWA（Pages 網域）與 Worker API 網域各自掛了獨立的 Cloudflare Access Application。
 * 使用者登入 PWA 後，瀏覽器只有 Pages 網域的 Access session cookie；對 API 網域的
 * `fetch()` 會被 Access 攔下並要求互動式登入（跳轉 + OTP），fetch 無法完成這個流程，
 * 請求就卡死。另外帶 `Content-Type: application/json` 的 POST/PATCH 會先發 CORS
 * preflight（OPTIONS 不帶 cookie），同樣被 Access 擋掉，所以「建立購票任務」「加入
 * 行事曆提醒」這類寫入操作在瀏覽器 Network 面板看起來像完全沒有送出請求。
 *
 * 改走同源 `/api/*` 之後：一次 Access 登入涵蓋 PWA 與 API，沒有跨網域、沒有 preflight。
 *
 * 轉發路徑，依序嘗試：
 *   1. Service Binding `API`（建議）：Pages 直接呼叫 Worker script，不經過 Cloudflare
 *      邊界，因此 API 網域上的 Access Application 可以原封不動保留，不需要動 Zero Trust。
 *   2. `API_ORIGIN` 環境變數：退而求其次，用一般 HTTP fetch 打 Worker 的公開網址。
 *      這條路徑會經過 Cloudflare 邊界，所以 API 網域上的 Access 必須先移除或改成允許
 *      Service Token，否則這個內部呼叫同樣會被擋。
 * 兩者都沒設定時回傳 503 並說明要設定什麼，不要靜默失敗。
 */

type ServiceBinding = {
  fetch: (request: Request) => Promise<Response>;
};

type ProxyEnv = {
  /** Pages 專案 Settings → Functions → Service bindings 綁定的 Worker（建議做法） */
  API?: ServiceBinding;
  /** 退路：Worker 公開網址，例如 https://ticket-radar-api-staging.vannyai.workers.dev */
  API_ORIGIN?: string;
};

type ProxyContext = {
  request: Request;
  env: ProxyEnv;
};

/**
 * 不轉發給 Worker 的請求標頭：
 * - 逐跳（hop-by-hop）標頭轉發後會讓下游行為不可預期。
 * - `cookie`：Worker 只認 `Cf-Access-Jwt-Assertion`，不需要 cookie；不轉發可避免把
 *   Pages 網域的 `CF_Authorization` 這類 Access session cookie 再往下游送一份。
 * - `host`／`content-length` 由 Request 建構子依實際目標與 body 重新決定。
 *
 * 注意：`Cf-Access-Jwt-Assertion` 與 `CF-Connecting-IP` 必須保留——前者是 Worker
 * `auth.ts` 唯一的身分來源，後者是 `rate-limit.ts` 的分桶依據。
 */
const STRIPPED_REQUEST_HEADERS = new Set([
  "connection",
  "content-length",
  "cookie",
  "host",
  "keep-alive",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

/** 回應標頭同樣要去掉逐跳標頭，並確保受保護的 API 回應不被任何一層快取。 */
const STRIPPED_RESPONSE_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "transfer-encoding",
]);

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message, requestId: "" } }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": "no-store",
    },
  });
}

function buildForwardHeaders(request: Request): Headers {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!STRIPPED_REQUEST_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

function buildResponse(upstream: Response): Response {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!STRIPPED_RESPONSE_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set("Cache-Control", "no-store");
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

async function buildForwardRequest(request: Request, target: string): Promise<Request> {
  const init: RequestInit = {
    method: request.method,
    headers: buildForwardHeaders(request),
    // Worker 不會回 3xx；真的收到就原樣交給前端判斷，不要自動跟隨到 Access 登入頁。
    redirect: "manual",
  };
  const method = request.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    // body 先讀成 ArrayBuffer（API payload 都很小），避免 stream 轉發的 duplex 相容性問題。
    init.body = await request.arrayBuffer();
  }
  return new Request(target, init);
}

export const onRequest = async (context: ProxyContext): Promise<Response> => {
  const { request, env } = context;
  const binding = env.API;
  const apiOrigin = env.API_ORIGIN?.trim();
  const incoming = new URL(request.url);

  let upstream: Response;
  try {
    if (binding) {
      // Service Binding 走 script 直呼，路徑原樣保留即可。
      upstream = await binding.fetch(await buildForwardRequest(request, request.url));
    } else if (apiOrigin) {
      const target = new URL(`${incoming.pathname}${incoming.search}`, apiOrigin);
      upstream = await fetch(await buildForwardRequest(request, target.toString()));
    } else {
      return jsonError(
        503,
        "API_PROXY_NOT_CONFIGURED",
        "API 轉發尚未設定：請在 Pages 專案綁定 Worker Service Binding（變數名 API），或設定 API_ORIGIN 環境變數。",
      );
    }
  } catch {
    return jsonError(
      502,
      "API_PROXY_UNREACHABLE",
      "暫時無法連線到 API 服務，請稍後再試。",
    );
  }

  return buildResponse(upstream);
};
