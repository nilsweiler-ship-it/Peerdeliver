/**
 * Shlep — shared form submission.
 *
 * Every form on the site (waitlist, Kontakt, /new) goes through submitForm().
 * It tries our own API first and falls back to the formsubmit.co relay if that
 * fails for any reason.
 *
 * Why the fallback stays: a signup we never see is the single most expensive
 * bug this site can have. The API is new, DNS for api.shlep.ch may still be
 * propagating, and Render's starter plan sleeps when idle — so the first
 * request after a quiet period can be slow or fail outright. The relay is the
 * safety net. It is only reached if the API did not accept the submission.
 *
 * The promise rejects only when BOTH paths fail, which is when the caller
 * should show an error plus a mailto link.
 */
(function (global) {
  'use strict';

  var API_BASE = 'https://api.shlep.ch';
  var RELAY = 'https://formsubmit.co/ajax/hello@shlep.ch';
  // Render's starter plan cold-starts. Give it room, but never hang the UI.
  var TIMEOUT_MS = 12000;

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var timer = setTimeout(function () {
        if (!done) { done = true; reject(new Error('timeout')); }
      }, ms);
      promise.then(
        function (v) { if (!done) { done = true; clearTimeout(timer); resolve(v); } },
        function (e) { if (!done) { done = true; clearTimeout(timer); reject(e); } }
      );
    });
  }

  function postJson(url, body) {
    return withTimeout(
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (data) {
          // A 4xx/5xx with a JSON body is still a failure — check both.
          if (!r.ok || !data || data.success !== true) {
            var msg = (data && (data.error || data.message)) || ('HTTP ' + r.status);
            throw new Error(msg);
          }
          return data;
        });
      }),
      TIMEOUT_MS
    );
  }

  /** Current UI language, if i18n.js is loaded on this page. */
  function currentLang() {
    try {
      return (global.SHLEP_LANG || document.documentElement.lang || 'de').slice(0, 2);
    } catch (e) {
      return 'de';
    }
  }

  /**
   * @param {string} path       API path, e.g. "/api/forms/waitlist"
   * @param {object} payload    Body for our API
   * @param {object} relayBody  Body for the formsubmit fallback (needs _subject)
   * @returns {Promise<{via:string}>}
   */
  function submitForm(path, payload, relayBody) {
    var body = {};
    for (var k in payload) if (Object.prototype.hasOwnProperty.call(payload, k)) body[k] = payload[k];
    if (!body.language) body.language = currentLang();

    return postJson(API_BASE + path, body)
      .then(function () { return { via: 'api' }; })
      .catch(function (apiErr) {
        if (global.console && console.warn) {
          console.warn('[shlep] API submit failed, using relay:', apiErr && apiErr.message);
        }
        return postJson(RELAY, relayBody).then(function () { return { via: 'relay' }; });
      });
  }

  global.ShlepForms = { submit: submitForm, apiBase: API_BASE };
})(window);
