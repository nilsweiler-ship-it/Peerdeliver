/*!
 * Shlep checkout widget — drop-in delivery option for marketplaces.
 *
 * Usage (front-end only, no backend work required):
 *
 *   <div data-shlep
 *        data-key="pk_live_yourkey"
 *        data-from="47.3769,8.5417"
 *        data-to="47.5001,8.7501"
 *        data-size="medium"
 *        data-value="450"></div>
 *   <script src="https://shlep.ch/shlep-widget.js" async></script>
 *
 * The widget calls Shlep's read-only quote endpoint, renders a branded
 * delivery option with live price + availability, and links the buyer into
 * Shlep with the delivery prefilled. No PII is sent — only coordinates.
 *
 * Events: the container fires `shlep:quote` (detail = quote) and
 * `shlep:select` (detail = { deepLink, priceCHF }) so the host page can react.
 */
(function () {
  'use strict';

  var API = (window.SHLEP_API_BASE || 'https://api.shlep.ch') + '/api/partner/quote';
  var STYLE_ID = 'shlep-widget-style';

  var CSS = [
    '.shlepw{--sw-accent:#E0A32E;--sw-ink:#17160F;--sw-ink2:#57534A;--sw-line:rgba(23,22,15,.16);--sw-card:#FBFAF4;--sw-green:#14532D;',
    'font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--sw-ink);background:var(--sw-card);',
    'border:1.5px solid var(--sw-line);border-radius:14px;padding:16px 18px;display:flex;gap:14px;align-items:flex-start;max-width:560px;line-height:1.45;box-sizing:border-box}',
    '.shlepw *{box-sizing:border-box}',
    '.shlepw__mark{flex:none;margin-top:2px}',
    '.shlepw__body{flex:1;min-width:0}',
    '.shlepw__row{display:flex;justify-content:space-between;align-items:baseline;gap:12px}',
    '.shlepw__title{font-weight:700;font-size:15.5px;letter-spacing:-.01em}',
    '.shlepw__price{font-weight:700;font-size:17px;white-space:nowrap}',
    '.shlepw__sub{font-size:13px;color:var(--sw-ink2);margin-top:3px}',
    '.shlepw__meta{display:flex;flex-wrap:wrap;gap:6px 10px;margin-top:9px}',
    '.shlepw__chip{font-size:11.5px;font-weight:600;letter-spacing:.02em;background:#EFEADF;border:1px solid var(--sw-line);border-radius:999px;padding:3px 9px;white-space:nowrap}',
    '.shlepw__chip--eco{background:#E7F0E9;border-color:#c3ddc9;color:var(--sw-green)}',
    '.shlepw__cta{display:inline-block;margin-top:12px;background:var(--sw-accent);color:var(--sw-ink);font-weight:700;font-size:14px;',
    'padding:9px 18px;border-radius:999px;text-decoration:none;border:none;cursor:pointer;font-family:inherit}',
    '.shlepw__cta:hover{background:#d69922}',
    '.shlepw__dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:middle}',
    '.shlepw--loading{opacity:.6}',
    '.shlepw__err{font-size:13px;color:var(--sw-ink2)}',
    '@media(max-width:420px){.shlepw{flex-direction:column;gap:10px}}',
  ].join('');

  var MARK =
    '<svg width="26" height="26" viewBox="12 6 24 28" fill="none" aria-hidden="true">' +
    '<path d="M30 12 C 17 12, 17 20, 24 20 C 31 20, 31 28, 18 28" stroke="#E0A32E" stroke-width="3.7" stroke-linecap="round"/>' +
    '<circle cx="30" cy="12" r="2.7" fill="#E0A32E"/><circle cx="18" cy="28" r="3.6" fill="#E0A32E"/></svg>';

  var TEXT = {
    de: {
      title: 'Mit Shlep liefern lassen',
      sub: 'Nachbarn nehmen dein Paket auf einer Fahrt mit, die sie ohnehin machen.',
      cta: 'Mit Shlep senden',
      insured: 'Bis CHF 1’000 versichert',
      code: 'Code-verifizierte Übergabe',
      co2: 'kg CO₂ gespart',
      high: 'Viele Fahrten auf dieser Strecke',
      medium: 'Fahrten auf dieser Strecke',
      low: 'Wenige Fahrten — etwas Geduld',
      none: 'Noch keine Fahrten — trag dich ein',
      unknown: 'Verfügbarkeit wird geprüft',
      unavailable: 'Für diese Strecke noch nicht verfügbar.',
      err: 'Shlep-Lieferung gerade nicht verfügbar.',
      approx: 'ca.',
    },
    en: {
      title: 'Get it delivered with Shlep',
      sub: 'Neighbours carry your parcel on a trip they are already making.',
      cta: 'Send with Shlep',
      insured: 'Insured up to CHF 1,000',
      code: 'Code-verified handoff',
      co2: 'kg CO₂ saved',
      high: 'Many trips on this route',
      medium: 'Trips on this route',
      low: 'Few trips — may take longer',
      none: 'No trips yet — join the list',
      unknown: 'Checking availability',
      unavailable: 'Not available for this route yet.',
      err: 'Shlep delivery unavailable right now.',
      approx: 'approx.',
    },
  };

  function t(lang) {
    return TEXT[(lang || 'de').slice(0, 2).toLowerCase()] || TEXT.de;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function parsePair(v) {
    if (!v) return null;
    var p = String(v).split(',');
    if (p.length !== 2) return null;
    var lat = parseFloat(p[0]);
    var lng = parseFloat(p[1]);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat: lat, lng: lng };
  }

  function chf(n) {
    return 'CHF ' + Number(n).toFixed(2);
  }

  function coverageDot(level) {
    var c = { high: '#14532D', medium: '#E0A32E', low: '#B98114', none: '#8a867c', unknown: '#8a867c' }[level] || '#8a867c';
    return '<span class="shlepw__dot" style="background:' + c + '"></span>';
  }

  function render(el, quote, L) {
    if (!quote.available || (quote.coverage.level === 'none' && !quote.estimated)) {
      el.innerHTML =
        '<div class="shlepw__mark">' + MARK + '</div>' +
        '<div class="shlepw__body"><div class="shlepw__title">' + L.title + '</div>' +
        '<div class="shlepw__sub">' + (quote.available ? L.none : L.unavailable) + '</div>' +
        '<a class="shlepw__cta" href="https://shlep.ch" target="_blank" rel="noopener">shlep.ch</a></div>';
      return;
    }

    var covText = L[quote.coverage.level];
    var eta =
      quote.coverage.estimatedMatchHours != null
        ? ' · ' + L.approx + ' ' + quote.coverage.estimatedMatchHours + ' h'
        : '';

    el.innerHTML =
      '<div class="shlepw__mark">' + MARK + '</div>' +
      '<div class="shlepw__body">' +
      '<div class="shlepw__row"><span class="shlepw__title">' + L.title + '</span>' +
      '<span class="shlepw__price">' + chf(quote.priceCHF) + '</span></div>' +
      '<div class="shlepw__sub">' + L.sub + '</div>' +
      '<div class="shlepw__meta">' +
      '<span class="shlepw__chip">' + coverageDot(quote.coverage.level) + covText + eta + '</span>' +
      '<span class="shlepw__chip">' + L.insured + '</span>' +
      '<span class="shlepw__chip">' + L.code + '</span>' +
      '<span class="shlepw__chip shlepw__chip--eco">' + quote.co2SavedKg + ' ' + L.co2 + '</span>' +
      '</div>' +
      '<a class="shlepw__cta" href="' + quote.deepLink + '" target="_blank" rel="noopener">' + L.cta + '</a>' +
      '</div>';

    var cta = el.querySelector('.shlepw__cta');
    if (cta) {
      cta.addEventListener('click', function () {
        el.dispatchEvent(
          new CustomEvent('shlep:select', {
            bubbles: true,
            detail: { deepLink: quote.deepLink, priceCHF: quote.priceCHF },
          }),
        );
      });
    }
  }

  /**
   * Offline fallback.
   *
   * If the quote API is unreachable (network blip, or a partner integrating
   * before their key is live) we still render a usable option using the same
   * deterministic pricing formula the server uses. We deliberately omit the
   * coverage signal — supply data only exists server-side, and guessing it
   * would be dishonest. The CTA still works via the deep link.
   */
  function localQuote(body) {
    var R = 6371, r = function (d) { return d * Math.PI / 180; };
    var dLat = r(body.toLat - body.fromLat), dLng = r(body.toLng - body.fromLng);
    var h = Math.pow(Math.sin(dLat / 2), 2) +
      Math.pow(Math.sin(dLng / 2), 2) * Math.cos(r(body.fromLat)) * Math.cos(r(body.toLat));
    var km = Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
    var F = { small: 1, medium: 1.35, large: 1.9 }[body.size || 'small'] || 1;
    var price = Math.min(Math.max(Math.round((8 + km * 0.55) * F), 8), 200);
    var fee = Math.min(Math.round(Math.max(price * 0.09, 1.5) * 100) / 100, price);

    var p = new URLSearchParams({
      fromLat: body.fromLat.toFixed(5), fromLng: body.fromLng.toFixed(5),
      toLat: body.toLat.toFixed(5), toLng: body.toLng.toFixed(5),
      price: String(price), size: body.size || 'small', src: 'partner',
    });
    if (body.declaredValueCHF) p.set('value', String(body.declaredValueCHF));

    return {
      available: km <= 150,
      currency: 'CHF',
      priceCHF: price,
      distanceKm: km,
      platformFeeCHF: fee,
      driverPayoutCHF: Math.round((price - fee) * 100) / 100,
      coverage: { level: 'unknown', matchingRoutes: null, estimatedMatchHours: null },
      insuredUpToCHF: 1000,
      co2SavedKg: Math.round(km * 0.18 * 10) / 10,
      deepLink: 'https://shlep.ch/new?' + p.toString(),
      estimated: true,
    };
  }

  function mount(el) {
    if (el.getAttribute('data-shlep-mounted')) return;
    el.setAttribute('data-shlep-mounted', '1');

    var key = el.getAttribute('data-key');
    var from = parsePair(el.getAttribute('data-from'));
    var to = parsePair(el.getAttribute('data-to'));
    var L = t(el.getAttribute('data-lang') || document.documentElement.lang);

    el.className = (el.className ? el.className + ' ' : '') + 'shlepw shlepw--loading';

    if (!key || !from || !to) {
      el.className = el.className.replace(' shlepw--loading', '');
      el.innerHTML =
        '<div class="shlepw__mark">' + MARK + '</div><div class="shlepw__body">' +
        '<div class="shlepw__title">' + L.title + '</div>' +
        '<div class="shlepw__err">Missing data-key, data-from or data-to.</div></div>';
      return;
    }

    el.innerHTML =
      '<div class="shlepw__mark">' + MARK + '</div><div class="shlepw__body">' +
      '<div class="shlepw__title">' + L.title + '</div><div class="shlepw__sub">…</div></div>';

    var body = {
      fromLat: from.lat,
      fromLng: from.lng,
      toLat: to.lat,
      toLng: to.lng,
    };
    var size = el.getAttribute('data-size');
    if (size) body.size = size;
    var val = parseFloat(el.getAttribute('data-value'));
    if (!isNaN(val)) body.declaredValueCHF = val;

    fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shlep-Key': key },
      body: JSON.stringify(body),
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (res) {
        el.className = el.className.replace(' shlepw--loading', '');
        var q = res && (res.data || res);
        if (!res || res.success === false || !q || typeof q.priceCHF !== 'number') {
          throw new Error('bad response');
        }
        render(el, q, L);
        el.dispatchEvent(new CustomEvent('shlep:quote', { bubbles: true, detail: q }));
      })
      .catch(function () {
        el.className = el.className.replace(' shlepw--loading', '');
        try {
          var q = localQuote(body);
          render(el, q, L);
          el.dispatchEvent(new CustomEvent('shlep:quote', { bubbles: true, detail: q }));
        } catch (e) {
          el.innerHTML =
            '<div class="shlepw__mark">' + MARK + '</div><div class="shlepw__body">' +
            '<div class="shlepw__title">' + L.title + '</div>' +
            '<div class="shlepw__err">' + L.err + '</div></div>';
        }
      });
  }

  function scan() {
    injectStyle();
    var nodes = document.querySelectorAll('[data-shlep]');
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  // Public API for dynamic checkouts (SPA re-renders).
  window.Shlep = window.Shlep || {};
  window.Shlep.refresh = scan;
  window.Shlep.mount = function (el) {
    injectStyle();
    el.removeAttribute('data-shlep-mounted');
    mount(el);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
})();
