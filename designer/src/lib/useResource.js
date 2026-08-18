import { useCallback, useEffect, useState } from 'react';

/**
 * Fetch-on-mount with cancellation and a manual reload.
 *
 * Every dashboard page needs the same four things — data, an error, a "still
 * loading" state, and a refresh — so they share one implementation rather than
 * four subtly different copies. State is only ever written from the promise
 * callbacks, never synchronously during the effect, so a re-render is not
 * scheduled before the first paint.
 *
 * `key` guards against a stale response overwriting a newer one: results are
 * tagged with the key that produced them, and a result for a superseded key is
 * ignored.
 */
export function useResource(fetcher, key = '') {
  const [state, setState] = useState({
    key: null,
    data: null,
    error: '',
    status: 0,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.resolve()
      .then(fetcher)
      .then((data) => {
        if (!cancelled) setState({ key, data, error: '', status: 0 });
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            key,
            data: null,
            error: err.message || 'Something went wrong.',
            status: err.status || 0,
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // `fetcher` is expected to be stable (useCallback) or trivially recreated;
    // `key` is what actually identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Only surface data that belongs to the key being asked for right now.
  const fresh = state.key === key;

  return {
    data: fresh ? state.data : null,
    error: fresh ? state.error : '',
    status: fresh ? state.status : 0,
    loading: !fresh,
    setData: useCallback(
      (updater) =>
        setState((prev) => ({
          ...prev,
          data: typeof updater === 'function' ? updater(prev.data) : updater,
        })),
      [],
    ),
    clearError: useCallback(() => setState((prev) => ({ ...prev, error: '' })), []),
    reload,
  };
}
