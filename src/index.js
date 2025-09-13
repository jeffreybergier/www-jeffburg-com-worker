export default {
  async fetch(request, env, ctx) {
    const DESTINATION = "https://raw.githubusercontent.com/jeffreybergier/PortfolioSite/master/PortfolioSite/";
    const INDEX = "index.html";

    const url = new URL(request.url);
    let path = url.pathname;
    if (path.endsWith("/")) path += INDEX; // serve index.html for folders

    const targetUrl = DESTINATION + path;

    console.log("[Proxy]", path, "->", targetUrl);

    const resp = await fetch(targetUrl, { method: request.method });
    const ext = path.split(".").pop().toLowerCase();

    let contentType;
    if (ext === "html") contentType = "text/html; charset=UTF-8";
    else if (ext === "css") contentType = "text/css; charset=UTF-8";
    else if (ext === "js") contentType = "text/javascript; charset=UTF-8";
    else contentType = resp.headers.get("content-type") || "application/octet-stream";

    const headers = new Headers(resp.headers);
    headers.set("content-type", contentType);
    headers.delete("content-security-policy");

    return new Response(resp.body, {
      status: resp.status,
      headers,
    });
  }
};