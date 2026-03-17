// Vercel Edge Middleware — Geo detection for homepage personalization
// Sets a cookie with the detected city so the client-side JS can swap content instantly.
// This runs at the edge before the page is served, so the cookie is available on first load.

import { NextResponse } from 'next/server';

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
  const city = request.headers.get('x-vercel-ip-city') || '';
  const url = new URL(request.url);
  const overrideCity = url.searchParams.get('geo');

  const lookupCity = (overrideCity || city).toLowerCase().trim();
  const areaSlug = cityMapping[lookupCity] || 'default';

  const response = NextResponse.next();

  // Set geo cookie (expires in 1 hour so it stays fresh)
  response.cookies.set('renegade-geo', areaSlug, {
    maxAge: 3600,
    path: '/',
    sameSite: 'lax',
  });

  // Also set headers for debugging
  response.headers.set('x-geo-city', areaSlug);
  response.headers.set('x-geo-detected', city || 'unknown');

  return response;
}
