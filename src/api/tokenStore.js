/**
 * tokenStore — in-memory access token store.
 *
 * Security audit finding #2 fix:
 * The JWT access token is stored here as a plain module-level variable,
 * NOT in localStorage. Module memory is inaccessible to XSS scripts
 * (unlike localStorage which any JS on the page can read).
 *
 * Trade-off: the token is lost on page refresh — this is intentional.
 * AuthContext silently calls /auth/refresh on bootstrap using the
 * httpOnly refresh cookie (already in place) to re-obtain it.
 */

let _accessToken = null;

/** Store the access token in memory. */
export const setToken = (token) => { _accessToken = token; };

/** Read the current access token (null if not authenticated). */
export const getToken = () => _accessToken;

/** Clear the access token (call on logout). */
export const clearToken = () => { _accessToken = null; };
