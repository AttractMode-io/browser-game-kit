// Browser-only UI. Identity and authorization always belong to the backend.
export function mountAccountUI({ element, fetchImpl = globalThis.fetch, timeoutMs = 5000 }) {
  if (!element || typeof element.replaceChildren !== 'function') throw Error('Supply an account UI element.');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw Error('timeoutMs must be between 1 and 30000.');
  const document = element.ownerDocument;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const makeForm = (action, text) => {
    const form = document.createElement('form');
    form.method = 'post'; form.action = action; form.hidden = true;
    const button = document.createElement('button');
    button.type = 'submit'; button.textContent = text;
    form.append(button); return { form, button };
  };
  const login = makeForm('/auth/login', 'Sign in with Attract Mode');
  const logout = makeForm('/auth/logout', 'Sign out of this game');
  element.replaceChildren(status, login.form, logout.form);
  let disposed = false, revision = 0, controller;
  async function refresh() {
    if (disposed) return;
    controller?.abort();
    const current = controller = new AbortController();
    const timer = setTimeout(() => current.abort(), timeoutMs);
    const request = ++revision;
    login.form.hidden = true; logout.form.hidden = true;
    status.textContent = 'Checking your account. Guest play is available.';
    try {
      const response = await fetchImpl('/api/me', { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: current.signal });
      if (!response.ok) throw Error('Session unavailable');
      const session = await response.json();
      if (!session || typeof session.signedIn !== 'boolean') throw Error('Invalid session');
      if (disposed || request !== revision) return;
      login.form.hidden = session.signedIn;
      logout.form.hidden = !session.signedIn;
      login.button.textContent = session.demo === true ? 'Simulate sign-in (offline)' : 'Sign in with Attract Mode';
      status.textContent = session.demo === true
        ? (session.signedIn ? 'Offline test identity connected. No real account was used.' : 'Offline demo. Play as a guest or simulate sign-in.')
        : (session.signedIn ? 'Your Attract Mode account is connected.' : 'Play as a guest or sign in with Attract Mode.');
    } catch {
      if (!disposed && request === revision) status.textContent = 'Account connection unavailable. Guest play still works.';
    } finally { clearTimeout(timer); }
  }
  const ready = refresh();
  return { ready, refresh, dispose() { if (!disposed) { disposed = true; controller?.abort(); revision++; element.replaceChildren(); } } };
}
