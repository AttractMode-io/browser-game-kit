// Browser-only UI. Identity and authorization always belong to the backend.
export function mountAccountUI({ element, fetchImpl = globalThis.fetch }) {
  if (!element || typeof element.replaceChildren !== 'function') throw Error('Supply an account UI element.');
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
  let disposed = false, revision = 0;
  async function refresh() {
    const request = ++revision;
    login.form.hidden = true; logout.form.hidden = true;
    status.textContent = 'Checking your account. Guest play is available.';
    try {
      const response = await fetchImpl('/api/me', { credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
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
    }
  }
  const ready = refresh();
  return { ready, refresh, dispose() { if (!disposed) { disposed = true; revision++; element.replaceChildren(); } } };
}
