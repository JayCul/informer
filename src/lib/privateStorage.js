// The private state store is encrypted at rest with PBKDF2 plus AES-GCM, so
// midnight-js requires a password provider. This is what protects the
// contributor secret on disk, and the secret is what the nullifier is derived
// from, so it matters more than it looks.
//
// The password is 32 random bytes, generated once per browser and kept in
// localStorage. It is never sent anywhere.
//
// Known tradeoff: keeping the password beside the ciphertext means encryption
// at rest protects against casual inspection of IndexedDB, not against an
// attacker who already has full access to this origin's storage. The stronger
// design is to derive the password from a wallet signature over a fixed
// message, which stores nothing and recovers on any device holding the same
// wallet. That is worth doing before contributors start storing real secrets.

const STORAGE_KEY = 'informer.privateStorageKey.v1';

const randomPassword = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes));
};

// Used when localStorage is unavailable (private windows, blocked site data).
// Private state then lives only for this page session.
let sessionFallback = null;

/**
 * @returns {() => string} a PrivateStoragePasswordProvider
 */
export function browserPasswordProvider() {
  return () => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;

      const created = randomPassword();
      localStorage.setItem(STORAGE_KEY, created);
      return created;
    } catch {
      sessionFallback ??= randomPassword();
      return sessionFallback;
    }
  };
}

/** True when the password survives a reload. False in private windows. */
export function passwordIsPersistent() {
  try {
    localStorage.setItem('informer.probe', '1');
    localStorage.removeItem('informer.probe');
    return true;
  } catch {
    return false;
  }
}
