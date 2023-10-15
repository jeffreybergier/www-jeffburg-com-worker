///
/// Here is my super shitty http proxy between my website and github.
///

/// For URL's that do not include a filename, appends the provided filename
function urlStringByAppendingFileNameIfNeededToURLString(fileName, url) {
    const lastPathComponent = url.split("/").slice(-1).pop();
    if (lastPathComponent.includes(".")) {
        return url;
    } else {
        return url + fileName;
    }
}

/// Prepares an options object for a request
function newRequestOptionsFromRequest(request) {
    return {
      body:    request.body,
      method:  request.method,
      headers: request.headers,
    };
}

function newResponseOptionsFromResponse(response, replacementHeaders) {
    return {
        status:     response.status,
        statusText: response.statusText,
        headers:    replacementHeaders,
    };
}

/// Checks if the status code is some form of HTTP success
function isSuccessStatusCodeNumber(code) {
    if (code >= 200 && code < 400) {
        return true;
    } else {
        return false;
    }
}

/// Gets file extension from a URL and lowercases it.
function fileExtensionFromURLString(url) {
    return (new URL(url)).pathname
                         .split("/").slice(-1).pop() // lastPathComponent
                         .split(".").slice(-1).pop() // fileExtension
                         .toLowerCase();
}

/// Creates new headers by copying the given headers
/// and setting the new mime type for Content-Type
function newHeadersByModifyingMIMEType(headers, mime) {
    const output = new Headers();
    headers.forEach((value, key) => {
        output.set(key, value);
    });
    output.set("content-type", mime);
    return output;
}

function new404Response() {
    const options = {
        status: 404,
    };
    return new Response("404: URLの記載ミス", options);
}

/// Global Variable to Enable Extra Logging.
/// This is configured by an environment variable in `onRequest()`.
var あぶないISDEBUG = true;

function LOG(object) {
    if (あぶないISDEBUG === false) { return; }
    
    const STACK_LINE_REGEX = /(\d+):(\d+)\)?$/;
    var error;
    var line = -2;
    
    // Failed attempt to find the line number by creating an exception.
    // Logic works but Cloudflare optimizes the javascript,
    // so the line numbers don't match the source file.
    // https://kaihao.dev/posts/console-log-with-line-numbers
    try {
        throw new Error();
    } catch (_error) {
        error = _error;
    }
    try {
        const stacks = error.stack.split('\n');
        const [, _line] = STACK_LINE_REGEX.exec(stacks[2]);
        line = _line; // typeof = string
    } catch (error) {
        console.log(error);
        line = -1;
    }
    
    const kind = typeof object;
    if (kind === "string" 
     || kind === "number" 
     || kind === "bigint"
     || kind === "boolean"
     || kind === "undefined"
     || kind === "symbol"
     || kind === null) 
    {
        console.log(`[${line}] ${object}`);
    } else {
        console.log(`[]${line}] ` + JSON.stringify(object, null, 4));
    }
}

/// MARK: Cloudflare Framework Call
export async function onRequest(context) {
    
    // Environment Variables
    あぶないISDEBUG          = context.env.DEBUG === "true";
    const SPECIAL_REDIRECT = JSON.parse(context.env.SPECIAL_REDIRECT);
    const ALWAYS_REDIRECT  = context.env.ALWAYS_REDIRECT === "true";
    const DESTINATION      = context.env.DEST_BASE_URL;
    const INDEX            = context.env.INDEX_FILE_NAME;
    
    LOG("[Begin] " + context.functionPath);
    
    // Always safe fallback; Redirect
    if (ALWAYS_REDIRECT === true) {
        LOG("[End] ALWAYS_REDIRECT: " + DESTINATION + context.functionPath);
        return Response.redirect(DESTINATION + context.functionPath, 301);
    }
    
    // Check for special redirect
    const redirect = SPECIAL_REDIRECT[context.functionPath];
    if (redirect != null) {
        LOG("[End] SPECIAL_REDIRECT: " + redirect);
        return Response.redirect(redirect, 301);
    }
    
    // Get the request URL
    const requestURLString = urlStringByAppendingFileNameIfNeededToURLString(
        INDEX, 
        DESTINATION + context.functionPath
    );
    
    // Perform the request to the destination
    LOG("[Internal] Request: " + requestURLString);
    const response = await fetch(requestURLString, newRequestOptionsFromRequest(context.request));
    LOG("[Internal] Response: " + response.status + ": " + response.headers.get("content-type"));

    // Guard statement to bail if the response code is not success
    if (isSuccessStatusCodeNumber(response.status) === false) {
        LOG("[End] Return Internal Response: Bad Status Code");
        return response; 
    }
    
    // Check the file type and then set the correct MIME type.
    // Required because Github returns "text/plain" for all text types.
    const responseFileExtension = fileExtensionFromURLString(response.url);
    if (responseFileExtension === "html") {
        const headers = newHeadersByModifyingMIMEType(
            response.headers, 
            "text/html; charset=UTF-8"
        );
        // Github sets content security policy, so it needs to be deleted or changed
        headers.delete("content-security-policy");
        const options = newResponseOptionsFromResponse(response, headers);
        LOG("[End] Return Modified MIME: " + headers.get("content-type"));
        return new Response(response.body, options);
    } else if (responseFileExtension === "css") {
        const headers = newHeadersByModifyingMIMEType(
            response.headers, 
            "text/css; charset=UTF-8"
        );
        const options = newResponseOptionsFromResponse(response, headers);
        LOG("[End] Return Modified MIME: " + headers.get("content-type"));
        return new Response(response.body, options);
    } else if (responseFileExtension === "js") {
        const headers = newHeadersByModifyingMIMEType(
            response.headers, 
            "text/javascript; charset=UTF-8"
        );
        const options = newResponseOptionsFromResponse(response, headers);
        LOG("[End] Return Modified MIME: " + headers.get("content-type"));
        return new Response(response.body, options);
    } else if (responseFileExtension === "php") {
        LOG("[End] Force 404: Requested PHP" + headers.get("content-type"));
        return new404Response();
    } else {
        // If not HTML/CSS/JS then the MIME type set by Github should be correct
        LOG("[End] Return Original MIME: " + response.headers.get("content-type"));
        return response
    }
}
