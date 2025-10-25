export default {
  async fetch(request, env, ctx) {
    const REPO = "jeffreybergier/jeffreybergier.github.io";
    const INDEX = "index.html";

    const url = new URL(request.url);

    // Map subdomain → branch
    const branchMap = {
      "insecure": "insecure",
      "staging" : "staging",
    };

    // Determine branch
    const subdomain = url.hostname.split(".")[0];
    var branch = branchMap[subdomain] || "insecure";
    if (branch == "insecure") {
      // special case for insecure to use the default gh-pages branch
      branch = "gh-pages"
    }
    
    const DESTINATION = `https://raw.githubusercontent.com/${REPO}/${branch}`;
    
    // Preserve request path
    let path = url.pathname;
    if (path.endsWith("/")) path += INDEX;
    const targetUrl = DESTINATION + path;
    console.log(`[Proxy] Host=${url.hostname}, Branch=${branch}, Path=${path} -> ${targetUrl}`);

    // Fetch from GitHub
    const resp = await fetch(targetUrl, { method: request.method });
    const ext = path.split(".").pop().toLowerCase();

    // Fix MIME types
    let contentType;
    if (ext === "html") contentType = "text/html; charset=UTF-8";
    else if (ext === "css") contentType = "text/css; charset=UTF-8";
    else if (ext === "js") contentType = "text/javascript; charset=UTF-8";
    else if (ext === "xml" || ext === "plist") contentType = "application/xml; charset=UTF-8";
    else if (ext === "mp4") contentType = "video/mp4";
    else if (ext === "mov") contentType = "video/quicktime";
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