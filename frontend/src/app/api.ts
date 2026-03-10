const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export default API_BASE;

/**
 * Custom fetch wrapper that includes the app_password from localStorage 
 * in the X-App-Password header.
 */
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  // Ensure we are in the browser
  const password = typeof window !== 'undefined' ? localStorage.getItem('app_password') : '';
  
  const headers = new Headers(options.headers || {});
  if (password) {
    headers.set('X-App-Password', password);
  }

  return fetch(url, {
    ...options,
    headers,
  });
};

