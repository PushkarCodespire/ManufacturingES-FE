import { useState, useCallback } from 'react';

/**
 * useAiSuggestion(apiFn)
 *
 * Generic hook for calling any AI endpoint.
 * Returns { data, loading, error, aiAvailable, cached, fetch, reset }.
 *
 * Usage:
 *   const ai = useAiSuggestion(aiApi.suggestRfqFill);
 *   ai.fetch({ customer_id: 5 });
 *   // ai.data → the parsed suggestion, ai.loading → boolean
 */
const useAiSuggestion = (apiFn) => {
  const [data, setData]             = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [aiAvailable, setAvailable] = useState(true);
  const [cached, setCached]         = useState(false);

  const fetch = useCallback(
    async (params) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiFn(params);
        setAvailable(result?.ai_available !== false);
        setCached(!!result?.cached);
        setData(result);
      } catch (err) {
        const msg = err?.message || err?.ai_error || 'AI request failed';
        setError(msg);
        setData(null);
        // If error indicates AI is down, mark unavailable
        if (msg.includes('not available') || msg.includes('API key')) {
          setAvailable(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [apiFn],
  );

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
    setCached(false);
  }, []);

  return { data, loading, error, aiAvailable, cached, fetch, reset };
};

export default useAiSuggestion;
