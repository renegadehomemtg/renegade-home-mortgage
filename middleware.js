// Vercel Edge Middleware — Geo detection for homepage personalization
// Sets a cookie with the detected city so the client-side JS can swap content instantly.
// This runs at the edge before the page is served, so the cookie is available on first load.

import { geolocation } from '@vercel/functions';
import { next } from '@vercel/functions';

export const config = {
  matcher: ['/', '/index.html'],
};

// City name normalization
const cityMapping = {
  'west linn': 'west-linn',
  'lake oswego': 'lake-oswego',
  'oregon city': 'oregon-city',
  tualatin: 'tualatin',
  wilsonville: 'wilsonville',
  stafford: 'west-linn',
  gladstone: 'oregon-city',
  durham: 'tualatin',
  sherwood: 'tualatin',
  canby: 'oregon-city',
};

export default function middleware(request) {
  const { city } = geolocation(request);
  const detectedCity = city || '';
  const url = new URL(request.url);
  const overrideCity = url.searchParams.get('geo');

  const lookupCity = (overrideCity || detectedCity).toLowerCase().trim();
  const areaSlug = cityMapping[lookupCity] || 'default';

  // Build Set-Cookie header manually
  const cookieValue = `renegade-geo=${areaSlug}; Max-Age=3600; Path=/; SameSite=Lax`;

  return next({
    headers: {
      'Set-Cookie': cookieValue,
      'x-geo-city': areaSlug,
      'x-geo-detected': detectedCity || 'unknown',
    },
  });
}
