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

function logObjectIfTrue(object, flag) {
    if (flag) {
        console.log(JSON.stringify(object, null, 4));
    }
}

/// MARK: Cloudflare Framework Call
export async function onRequest(context) {
    
    // Environment Variables
    const ALWAYS_REDIRECT = context.env.ALWAYS_REDIRECT === "true";
    const ISDEBUG         = context.env.DEBUG === "true";
    const DESTINATION     = context.env.DEST_BASE_URL;
    const INDEX           = context.env.INDEX_FILE_NAME;
    
    // Always safe fallback; Redirect
    if (ALWAYS_REDIRECT === true) {
        return Response.redirect(DESTINATION + context.functionPath, 301);
    }
    
    // 1. Get the request URL
    const requestURLString = urlStringByAppendingFileNameIfNeededToURLString(
        INDEX, 
        DESTINATION + context.functionPath
    );
    
    // 2. Perform the request to the destination
    const response = await fetch(requestURLString, newRequestOptionsFromRequest(context.request));
    logObjectIfTrue(response.status + ": " + response.statusText, ISDEBUG);

    // 3. Guard statement to bail if the response code is not success
    if (isSuccessStatusCodeNumber(response.status) === false) {
        return response; 
    }
    
    // 4. Check the file type and then set the correct MIME type.
    //    Required because Github returns "text/plain" for all text types.
    const responseFileExtension = fileExtensionFromURLString(response.url);
    if (responseFileExtension === "html") {
        const headers = newHeadersByModifyingMIMEType(
            response.headers, 
            "text/html; charset=UTF-8"
        );
        // Github sets content security policy, so it needs to be deleted or changed
        headers.delete("content-security-policy");
        const options = newResponseOptionsFromResponse(response, headers);
        logObjectIfTrue(headers.get("content-type") + ": Modified Content Type", ISDEBUG);
        return new Response(response.body, options);
    } else if (responseFileExtension === "css") {
        const headers = newHeadersByModifyingMIMEType(
            response.headers, 
            "text/css; charset=UTF-8"
        );
        const options = newResponseOptionsFromResponse(response, headers);
        logObjectIfTrue(headers.get("content-type") + ": Modified Content Type", ISDEBUG);
        return new Response(response.body, options);
    } else if (responseFileExtension === "js") {
        const headers = newHeadersByModifyingMIMEType(
            response.headers, 
            "text/javascript; charset=UTF-8"
        );
        const options = newResponseOptionsFromResponse(response, headers);
        logObjectIfTrue(headers.get("content-type") + ": Modified Content Type", ISDEBUG);
        return new Response(response.body, options);
    } else if (responseFileExtension === "php") {
        const options = {
            status:     404,
            statusText: "File not found",
        };
        logObjectIfTrue("PHP: Force 404", ISDEBUG);
        return new Response("404 File not found", options);
    } else {
        // If not HTML/CSS/JS then the MIME type set by Github should be correct
        logObjectIfTrue(response.headers.get("content-type") + ": Original Content Type", ISDEBUG);
        return response
    }
}
