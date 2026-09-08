// Tracing for the deploy path.
//
// "Failed to fetch" from deep inside a provider tells you nothing about which
// provider failed. These wrappers log every provider call as it starts and
// finishes, so a failure names the exact call and carries a real stack.

/** Wraps one function, preserving sync vs async behaviour. */
const traceFn = (label, fn, thisArg, log) =>
  function (...args) {
    log(`-> ${label}`);
    let out;
    try {
      out = fn.apply(thisArg ?? this, args);
    } catch (err) {
      log(`XX ${label} threw: ${err.name}: ${err.message}`, 'err');
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
          log(`XX ${label} rejected: ${err.name}: ${err.message}`, 'err');
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
