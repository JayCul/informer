// Tracing for the deploy path.
//
// "Failed to fetch" from deep inside a provider tells you nothing about which
// provider failed. These wrappers log every provider call as it starts and
// finishes, so a failure names the exact call and carries a real stack.

/**
 * Renders anything thrown into something readable. The DApp connector rejects
 * with plain objects, which stringify to "[object Object]" and lose every
 * field that would explain the failure.
 */
export function describeError(err) {
  if (err == null) return String(err);
  if (typeof err === 'string') return err;
  if (err instanceof Error && err.message) return `${err.name}: ${err.message}`;

  const parts = [];
  for (const key of ['name', 'message', 'code', 'reason', 'detail', 'error', 'status']) {
    if (err[key] != null && typeof err[key] !== 'object') {
      parts.push(`${key}=${err[key]}`);
    }
  }
  if (parts.length) return parts.join(' ');

  try {
    const seen = new WeakSet();
    const json = JSON.stringify(
      err,
      (_k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[circular]';
          seen.add(v);
        }
        return typeof v === 'bigint' ? String(v) : v;
      },
    );
    if (json && json !== '{}') return json.slice(0, 400);
  } catch {
    /* fall through */
  }
  return Object.prototype.toString.call(err);
}

/** Wraps one function, preserving sync vs async behaviour. */
const traceFn = (label, fn, thisArg, log) =>
  function (...args) {
    log(`-> ${label}`);
    let out;
    try {
      out = fn.apply(thisArg ?? this, args);
    } catch (err) {
      log(`XX ${label} threw: ${describeError(err)}`, 'err');
      console.error(label, err);
      throw err;
    }
    if (out && typeof out.then === 'function') {
      return out.then(
        (value) => {
          log(`ok ${label}`);
          return value;
        },
        (err) => {
          log(`XX ${label} rejected: ${describeError(err)}`, 'err');
          console.error(label, err);
          throw err;
        },
      );
    }
    log(`ok ${label}`);
    return out;
  };

/**
 * Returns an object that delegates to `obj` but logs the named methods.
 * Methods are looked up through the prototype chain, so class instances work.
 */
export const traceObject = (name, obj, methods, log) => {
  const wrapper = Object.create(obj);
  for (const method of methods) {
    const fn = obj[method];
    if (typeof fn !== 'function') continue;
    wrapper[method] = traceFn(`${name}.${method}`, fn, obj, log);
  }
  return wrapper;
};

/** Surfaces errors that escape the promise chain into the page log. */
export const installGlobalErrorLogging = (log) => {
  window.addEventListener('unhandledrejection', (event) => {
    const err = event.reason;
    log(
      `unhandled rejection: ${err?.name ?? 'Error'}: ${err?.message ?? String(err)}`,
      'err',
    );
    console.error('unhandledrejection', err);
  });
  window.addEventListener('error', (event) => {
    log(`window error: ${event.message}`, 'err');
  });
};

/**
 * Records every fetch the page makes, so a failing request can be named even
 * when the library swallows the URL.
 */
export const installFetchLogging = (log) => {
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : (input?.url ?? String(input));
    const method = init?.method ?? 'GET';
    try {
      const response = await original(input, init);
      if (!response.ok) {
        log(`http ${response.status} ${method} ${url}`, 'err');
      }
      return response;
    } catch (err) {
      log(`fetch failed ${method} ${url}: ${err.message}`, 'err');
      console.error('fetch failed', url, err);
      throw err;
    }
  };
};
