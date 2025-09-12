///
/// Cloudflare Function: GitHub Proxy
/// Proxies requests to a GitHub repo and fixes MIME types.
///

// --- Utility Functions ---

function urlStringByAppendingFileNameIfNeededToURLString(fileName, url) {
  const lastPathComponent = url.split("/").slice(-1).pop();
  if (lastPathComponent.includes(".")) {
    return url;
  } else {
    return url + fileName;
  }
}

function safeHeaders(request) {
  const out = new Headers();
  request.headers.forEach((v, k) => {
    const lower = k.toLowerCase();
    if (!["host", "cf-connecting-ip", "x-forwarded-for", "content-length"].includes(lower)) {
      out.set(k, v);
    }
  });
  return out;
}

function newResponseOptionsFromResponse(response, replacementHeaders) {
  return {
    status: response.status,
    statusText: response.statusText,
    headers: replacementHeaders,
  };
}

function isSuccessStatusCodeNumber(code) {
  return code >= 200 && code < 400;
}

function fileExtensionFromURLString(url) {
  return new URL(url).pathname.split("/").slice(-1).pop().split(".").slice(-1).pop().toLowerCase();
}

function newHeadersByModifyingMIMEType(headers, mime) {
  const output = new Headers();
  headers.forEach((value, key) => {
    output.set(key, value);
  });
  output.set("content-type", mime);
  output.delete("content-security-policy"); // always strip CSP
  return output;
}

function new404Response() {
  return new Response("404: URLの記載ミス", { status: 404 });
}

// --- MIME Overrides ---

const MIME_OVERRIDES = {
  html: "text/html; charset=UTF-8",
  css: "text/css; charset=UTF-8",
  js: "text/javascript; charset=UTF-8",
};

function overrideMIME(ext, response) {
  const mime = MIME_OVERRIDES[ext];
  if (!mime) return response; // pass-through

  const headers = newHeadersByModifyingMIMEType(response.headers, mime);
  const options = newResponseOptionsFromResponse(response, headers);
  return new Response(response.body, options);
}

// --- Logging ---

var あぶないISDEBUG = true;
function LOG(msg) {
  if (あぶないISDEBUG) console.log(msg);
}

// --- Cloudflare Entry Point ---

export async function onRequest(context) {
  // Environment
  あぶないISDEBUG = context.env.DEBUG === "true";
  const ALWAYS_REDIRECT = context.env.ALWAYS_REDIRECT === "true";
  const SPECIAL_REDIRECT = JSON.parse(context.env.SPECIAL_REDIRECT || "{}");
  const DESTINATION = context.env.DEST_BASE_URL;
  const INDEX = context.env.INDEX_FILE_NAME;

  LOG(`[Begin] ${context.functionPath}`);

  // Always redirect if configured
  if (ALWAYS_REDIRECT) {
    LOG(`[Redirect] Always → ${DESTINATION}${context.functionPath}`);
    return Response.redirect(DESTINATION + context.functionPath, 301);
  }

  // Special redirect mapping
  const redirect = SPECIAL_REDIRECT[context.functionPath];
  if (redirect) {
    LOG(`[Redirect] Special → ${redirect}`);
    return Response.redirect(redirect, 301);
  }

  // Build target URL
  const target = urlStringByAppendingFileNameIfNeededToURLString(
    INDEX,
    DESTINATION + context.functionPath
  );

  LOG(`[Fetch] → ${target}`);
  const response = await fetch(target, {
    method: context.request.method,
    body: context.request.body,
    headers: safeHeaders(context.request),
  });

  LOG(`[Response] ${response.status} ${response.headers.get("content-type")}`);

  // Bail out if not success
  if (!isSuccessStatusCodeNumber(response.status)) {
    LOG(`[End] Bad status → ${response.status}`);
    return response; // or replace with new404Response() if you want custom
  }

  // Extension handling
  const ext = fileExtensionFromURLString(response.url);
  if (ext === "php" || ["exe", "cgi", "sh"].includes(ext)) {
    LOG(`[End] Blocked extension → .${ext}`);
    return new404Response();
  }

  const finalResponse = overrideMIME(ext, response);
  LOG(`[End] Served ${ext || "unknown"} → ${finalResponse.headers.get("content-type")}`);
  return finalResponse;
}