/* CSP Operation Portal â€” portal session relay
 *
 * Supports two modes depending on URL params:
 *
 * MODE 1 â€” sessionStorage relay (Playwright mode, legacy):
 *   ?tr=<base64-tokenResponse>&target=<encoded-portal-home-url>
 *   Writes sessionStorage['tokenResponse'] then redirects.
 *
 * MODE 2 â€” localStorage PKCE relay (direct API mode):
 *   ?code=<AUTH_CODE>&cv=<code_verifier>&state=<state>&target=<encoded-portal-home-url>
 *   Seeds localStorage so tokenhelper.js can complete the token exchange.
 *   tokenhelper.js reads localStorage["{state}_appauth_authorization_request"].code_verifier
 *
 * This script runs in the AEM page context (same origin as portal).
 */
(function () {
  var p = new URLSearchParams(window.location.search);
  var target = decodeURIComponent(p.get('target') || '');

  // MODE 2: PKCE relay â€” seed localStorage for tokenhelper.js
  var code = p.get('code');
  var cv   = p.get('cv');
  var state = p.get('state');

  if (code && cv && state) {
    try {
      // tokenhelper.js looks up: localStorage["{state}_appauth_authorization_request"]
      var lsKey = state + '_appauth_authorization_request';
      var existing = {};
      try { existing = JSON.parse(localStorage.getItem(lsKey) || '{}'); } catch(e) {}
      existing.code_verifier = cv;
      existing.state = state;
      localStorage.setItem(lsKey, JSON.stringify(existing));
      // Also write the current state key so tokenhelper knows which request is active
      localStorage.setItem('appauth_current_authorization_request', state);
      console.log('[csp-relay] PKCE seeded for state:', state);
    } catch (e) {
      console.error('[csp-relay] Failed to seed localStorage', e);
    }
    // Redirect to portal home with code+state in URL so tokenhelper picks it up
    if (target) {
      var url = target;
      url += (url.indexOf('?') >= 0 ? '&' : '?') + 'code=' + encodeURIComponent(code) + '&state=' + encodeURIComponent(state);
      window.location.replace(url);
    }
    return;
  }

  // MODE 1: sessionStorage relay (Playwright mode)
  var tr = p.get('tr');
  if (tr) {
    try {
      sessionStorage.setItem('tokenResponse', atob(tr));
      console.log('[csp-relay] tokenResponse written to sessionStorage');
    } catch (e) {
      console.error('[csp-relay] Failed to store token response', e);
    }
    if (target) {
      window.location.replace(target);
    }
    return;
  }

  console.error('[csp-relay] No relay params found in URL');
})();
