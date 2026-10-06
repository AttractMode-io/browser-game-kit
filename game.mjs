// Browser bundle: deliberately contains no OAuth secret, verifier or token handling.
const identity = document.querySelector('#identity');
const login = document.querySelector('form[action="/auth/login"]');
const logout = document.querySelector('form[action="/auth/logout"]');
login.hidden = true;
logout.hidden = true;
let hits = 0;
const target = document.querySelector('#target'),
  score = document.querySelector('#score');
target.addEventListener('click', () => {
  hits++;
  score.textContent = hits + ' hits';
  target.style.left = Math.floor(Math.random() * 80) + '%';
  target.style.top = Math.floor(Math.random() * 75) + '%';
});

try {
  const response = await fetch('/api/me', { cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw Error('Session unavailable');
  const session = await response.json();
  login.hidden = Boolean(session.signedIn);
  logout.hidden = !session.signedIn;
  identity.textContent = session.signedIn
    ? (session.demo ? 'Offline test identity connected. No real Attract Mode account was used.' : 'Your Attract Mode account is connected to this game.')
    : (session.demo ? 'Practice as a guest, or simulate sign-in with an offline test identity. No real account is used.' : 'Practice as a guest, or sign in with your Attract Mode account.');
} catch {
  identity.textContent =
    'Account connection unavailable. Practice still works.';
}
