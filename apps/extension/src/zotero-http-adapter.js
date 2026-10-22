// Biblio adapter around the vendored Zotero HTTP API. The translator source remains unchanged;
// cross-origin requests are made by the extension worker so publisher CORS headers do not change
// which official Zotero translator runs.
(() => {
  const pageRequest = Zotero.HTTP.request.bind(Zotero.HTTP);
  const request = async (method, url, options = {}) => {
    if (!globalThis.chrome?.runtime?.sendMessage) return pageRequest(method, url, options);
    const responseType = options.responseType || "";
    const response = await chrome.runtime.sendMessage({
      type: "zotero-http",
      method,
      url,
      headers: options.headers || {},
      body: options.body ?? null,
      responseCharset: options.responseCharset || "",
      binary: responseType === "arraybuffer" || responseType === "blob"
    });
    if (!response?.ok) throw new Error(response?.error || `HTTP request failed for ${url}`);
    // A stand-in for the XMLHttpRequest Zotero's HTTP layer expects, so translators that read
    // headers, parse JSON or documents, or take binary data behave as they do in the Connector.
    const responseURL = response.responseURL || url;
    const responseText = response.responseText || "";
    const headerLines = response.headers || "";
    const headerMap = new Map(
      headerLines.split(/\r?\n/).filter(Boolean).map((line) => {
        const at = line.indexOf(":");
        return [line.slice(0, at).trim().toLowerCase(), line.slice(at + 1).trim()];
      })
    );
    let parsedDocument;
    const asDocument = () => {
      if (parsedDocument === undefined) {
        const type = headerMap.get("content-type") || "";
        parsedDocument = new DOMParser().parseFromString(responseText, /xml/i.test(type) && !/html/i.test(type) ? "application/xml" : "text/html");
      }
      return parsedDocument;
    };
    const binary = () => {
      const bytes = Uint8Array.from(atob(response.base64 || ""), (c) => c.charCodeAt(0));
      return responseType === "blob" ? new Blob([bytes], { type: headerMap.get("content-type") || "" }) : bytes.buffer;
    };
    const xhr = {
      status: response.status,
      statusText: response.statusText || "",
      readyState: 4,
      responseURL,
      responseType,
      responseText,
      get responseXML() {
        return asDocument();
      },
      get response() {
        if (responseType === "json") {
          try {
            return JSON.parse(responseText);
          } catch {
            return null;
          }
        }
        if (responseType === "document") return asDocument();
        if (responseType === "arraybuffer" || responseType === "blob") return binary();
        return responseText;
      },
      getAllResponseHeaders: () => headerLines,
      getResponseHeader: (name) => headerMap.get(String(name).toLowerCase()) ?? null
    };
    const successCodes = options.successCodes;
    const invalidDefault = successCodes === null || successCodes === undefined;
    const invalidStatus = Array.isArray(successCodes) && !successCodes.includes(xhr.status);
    if ((invalidDefault && (xhr.status < 200 || xhr.status >= 300)) || invalidStatus) {
      throw new Zotero.HTTP.StatusError(xhr, url);
    }
    return xhr;
  };
  Zotero.HTTP.request = request;
  Zotero.HTTP.doGet = (url, onDone, responseCharset, cookieSandbox, headers) => {
    request("GET", url, { headers })
      .then(onDone)
      .catch((error) => onDone({ status: error.status || 0, responseText: error.responseText || "" }));
    return true;
  };
  Zotero.HTTP.doPost = (url, body, onDone, headers) => {
    request("POST", url, { body, headers })
      .then(onDone)
      .catch((error) => onDone({ status: error.status || 0, responseText: error.responseText || "" }));
    return true;
  };
})();
