(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EnumerationDataPipe = api;
})(globalThis, function () {
  'use strict';
  async function send(experimentID, filename, data, options = {}) {
    if (!experimentID || !experimentID.trim()) return {status: 'not_configured'};
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 30000);
    try {
      const body = JSON.stringify({experimentID: experimentID.trim(), filename, data});
      const headers = {'Content-Type': 'application/json'};
      let payload = body;
      // The full record contains frame diagnostics; compress large requests before sending.
      if (new TextEncoder().encode(body).length > 10000000 && typeof CompressionStream !== 'undefined') {
        payload = await new Response(new Blob([body]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
        headers['Content-Encoding'] = 'gzip';
      }
      const response = await (options.fetch || fetch)('https://pipe.jspsych.org/api/data/', {
        method: 'POST', headers, body: payload, signal: controller.signal
      });
      let result = {};
      try { result = await response.json(); } catch { /* Preserve the HTTP status. */ }
      if (response.status === 201) return {status: 'saved', filename};
      if (response.status === 202) return {status: 'queued', filename};
      return {status: 'failed', filename, detail: result.error || `HTTP ${response.status}`};
    } catch (error) {
      // A lost response does not prove the server failed to save the file.
      return {status: 'uncertain', filename, detail: error.name === 'AbortError' ? 'Request timed out' : 'Connection failed'};
    } finally { clearTimeout(timer); }
  }
  return {send};
});
