import axios from 'axios';

// Same-origin: the Vite dev server proxies /api to the backend, so cookies
// (sessionid, csrftoken) are first-party. CSRF token echoed back on unsafe methods.
const apiClient = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

apiClient.interceptors.request.use((config) => {
  const csrfToken = getCookie('csrftoken');
  if (csrfToken && config.method !== 'get') {
    config.headers['X-CSRFToken'] = csrfToken;
  }
  return config;
});

export default apiClient;
