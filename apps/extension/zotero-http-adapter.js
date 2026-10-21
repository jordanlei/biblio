// Biblio adapter around the vendored Zotero HTTP API. The translator source remains unchanged;
// cross-origin requests are made by the extension worker so publisher CORS headers do not change
// which official Zotero translator runs.
(() => {
  const pageRequest = Zotero.HTTP.request.bind(Zotero.HTTP);
  const request = async (method, url, options = {}) => {
    if (!globalThis.chrome?.runtime?.sendMessage) return pageRequest(method, url, options);
    const response = await chrome.runtime.sendMessage({
      type: "zotero-http",
      method,
      url,
      headers: options.headers || {},
      body: options.body ?? null
    });
    if (!response?.ok) throw new Error(response?.error || `HTTP request failed for ${url}`);
    const xhr = {
      status: response.status,
      responseURL: response.responseURL || url,
      responseText: response.responseText || ""
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
