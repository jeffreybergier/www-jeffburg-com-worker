export default {
  async fetch(request, env, ctx) {
    // Your GitHub repo name
    const REPO = "jeffreybergier/www-jeffburg-com";
    const INDEX = "index.html";

    // Parse incoming request
    const url = new URL(request.url);
    const host = url.hostname; // e.g., "www.jeffburg.com" or "staging.jeffburg.com"

    // Extract branch from the subdomain (everything before first dot)
    // www.jeffburg.com  -> "www"
    // staging.jeffburg.com -> "staging"
    const subdomain = host.split(".")[0];

    // Default to "www" branch if you want a fallback
    const branch = subdomain || "www";

    // Build destination base URL
    const DESTINATION = `https://raw.githubusercontent.com/${REPO}/${branch}/web-root`;

    // Preserve request path
    let path = url.pathname;
    if (path.endsWith("/")) path += INDEX;

    const targetUrl = DESTINATION + path;

    console.log(`[Proxy] Host=${host}, Branch=${branch}, Path=${path} -> ${targetUrl}`);

    // Fetch from GitHub
    const resp = await fetch(targetUrl, { method: request.method });
    const ext = path.split(".").pop().toLowerCase();

    // Fix MIME types
    let contentType;
    if (ext === "html") contentType = "text/html; charset=UTF-8";
    else if (ext === "css") contentType = "text/css; charset=UTF-8";
    else if (ext === "js") contentType = "text/javascript; charset=UTF-8";
    else contentType = resp.headers.get("content-type") || "application/octet-stream";

    // Adjust headers
    const headers = new Headers(resp.headers);
    headers.set("content-type", contentType);
    headers.delete("content-security-policy");

    return new Response(resp.body, {
      status: resp.status,
      headers,
    });
  }
};