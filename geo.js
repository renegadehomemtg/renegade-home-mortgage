/* ================================================================
   Renegade Home Mortgage — Geo-Personalization Engine
   Reads the renegade-geo cookie (set by Edge Middleware) and swaps
   homepage content to match the visitor's detected city.
   ================================================================ */
(function () {
  'use strict';

  // ── Read geo cookie ────────────────────────────────────────────
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  var geo = getCookie('renegade-geo');

  // Also check URL param for testing: ?geo=lake-oswego
  var params = new URLSearchParams(window.location.search);
  if (params.get('geo')) {
    geo = params.get('geo').toLowerCase().trim();
  }

  // If default or west-linn, no changes needed
  if (!geo || geo === 'default' || geo === 'west-linn') return;

  // ── Area Content ───────────────────────────────────────────────
  var areas = {
    'lake-oswego': {
      badge: 'Lake Oswego, Oregon',
      headline: 'Your Lake Oswego <em>Mortgage Expert</em>',
      heroParagraph:
        "We're not a big bank. We're your neighbors in the Lake Oswego area, and we shop 50+ lenders to find you the best mortgage rate, every single time.",
      spotlightTitle: 'Lake Oswego Real Estate Corner',
      spotlightIntro:
        "With a median home value of $900K, Lake Oswego is one of Oregon's most sought-after communities. Here's what you need to know about financing in this premium market.",
      marketSnapshot:
        "Lake Oswego's tree-lined streets, top-rated schools, and proximity to downtown Portland make it a magnet for families and professionals. From lakefront estates in First Addition to newer construction in Mountain Park, the city offers diverse neighborhoods with consistently strong home values. With homes selling in roughly 21 days, moving quickly with a strong pre-approval is essential.",
      marketSnapshotCta: 'Explore Neighborhoods',
      marketSnapshotLink: './neighborhoods.html',
      jumboTitle: 'Why Jumbo Matters in Lake Oswego',
      jumboText:
        "With a median sale price of $900K, the vast majority of Lake Oswego purchases require jumbo financing. As an independent broker, we access wholesale jumbo rates that big banks can't match. Whether you're eyeing a Lake View Village townhome or a custom build in Palisades, we structure loans built for Lake Oswego's premium market.",
      jumboLink: './blog/jumbo-loans-west-linn.html',
      jumboCta: 'Read Our Jumbo Loan Guide',
      jumboCardText:
        "Lake Oswego's median home is $900K, well into jumbo territory. We specialize in large loans with surprisingly competitive terms.",
      testimonialSection: 'Trusted by Families Across the Portland Metro',
      communityTitle: 'Your Lake Oswego Neighbors',
      communityText:
        "We're more than a mortgage company. We serve Lake Oswego, West Linn, and the surrounding communities with the same local expertise and personal attention. When you work with us, you're working with a neighbor who understands your market.",
      pageTitle: "Renegade Home Mortgage | Lake Oswego, Oregon's Neighborhood Mortgage Expert",
    },
    'oregon-city': {
      badge: 'Oregon City, Oregon',
      headline: 'Your Oregon City <em>Mortgage Expert</em>',
      heroParagraph:
        "We're not a big bank. We're your neighbors in the Oregon City area, and we shop 50+ lenders to find you the best mortgage rate, every single time.",
      spotlightTitle: 'Oregon City Real Estate Corner',
      spotlightIntro:
        "With a median home value of $581K, Oregon City offers strong value and a growing community at the doorstep of the Willamette Valley. Here's what you need to know.",
      marketSnapshot:
        "Oregon City's historic downtown, stunning Willamette Falls views, and growing neighborhoods like Beavercreek Road and Park Place are drawing buyers who want space, character, and value. Homes are selling in roughly 18 days, and the city's mix of older Craftsman homes and new developments means there's a loan program for every buyer.",
      marketSnapshotCta: 'Explore Neighborhoods',
      marketSnapshotLink: './neighborhoods.html',
      jumboTitle: 'Smart Financing in Oregon City',
      jumboText:
        "Oregon City's diverse price range means more loan options. From FHA loans for first-time buyers in the downtown core to conventional and jumbo products for newer construction in South End and Beavercreek, we match the right program to your purchase. As an independent broker, we shop 50+ lenders to get you the best terms available.",
      jumboLink: './programs.html',
      jumboCta: 'View All Loan Programs',
      jumboCardText:
        "Oregon City's $581K median offers great value. We match the right loan program to your purchase, whether FHA, conventional, or jumbo.",
      testimonialSection: 'Trusted by Families Across the Portland Metro',
      communityTitle: 'Serving the Oregon City Community',
      communityText:
        "We're more than a mortgage company. We serve Oregon City, West Linn, and the surrounding Clackamas County communities with local expertise and personal attention. When you work with us, you're working with a neighbor who understands your market.",
      pageTitle: "Renegade Home Mortgage | Oregon City, Oregon's Neighborhood Mortgage Expert",
    },
    tualatin: {
      badge: 'Tualatin, Oregon',
      headline: 'Your Tualatin <em>Mortgage Expert</em>',
      heroParagraph:
        "We're not a big bank. We're your neighbors in the Tualatin area, and we shop 50+ lenders to find you the best mortgage rate, every single time.",
      spotlightTitle: 'Tualatin Real Estate Corner',
      spotlightIntro:
        "With a median home value around $631K and a family-friendly community along the Tualatin River, Tualatin is one of the Portland metro's best-kept secrets. Here's what you need to know.",
      marketSnapshot:
        "Tualatin combines a small-town feel with big-city access. From established neighborhoods like Rosewood and Cook Park to the new builds in the Childs neighborhood, Tualatin offers diverse housing options across a wide price spectrum. The city's highly rated schools, extensive greenways, and easy access to I-5 and 99W make it a top choice for commuting families.",
      marketSnapshotCta: 'Explore Neighborhoods',
      marketSnapshotLink: './neighborhoods.html',
      jumboTitle: 'Finding the Right Loan in Tualatin',
      jumboText:
        "Tualatin's diverse price range means most buyers have options. Conventional loans work well for homes under the conforming limit, while our jumbo products cover the premium neighborhoods like Blue Heron and Westridge. As an independent broker, we shop 50+ lenders to find the best match for your Tualatin purchase.",
      jumboLink: './programs.html',
      jumboCta: 'View All Loan Programs',
      jumboCardText:
        "Tualatin's $631K median gives you options. We match you with the ideal loan, whether conventional, FHA, VA, or jumbo.",
      testimonialSection: 'Trusted by Families Across the Portland Metro',
      communityTitle: 'Serving the Tualatin Community',
      communityText:
        "We're more than a mortgage company. We serve Tualatin, West Linn, and the entire Portland metro area with the same local expertise and personal attention. When you work with us, you're working with a neighbor who understands your market.",
      pageTitle: "Renegade Home Mortgage | Tualatin, Oregon's Neighborhood Mortgage Expert",
    },
    wilsonville: {
      badge: 'Wilsonville, Oregon',
      headline: 'Your Wilsonville <em>Mortgage Expert</em>',
      heroParagraph:
        "We're not a big bank. We're your neighbors in the Wilsonville area, and we shop 50+ lenders to find you the best mortgage rate, every single time.",
      spotlightTitle: 'Wilsonville Real Estate Corner',
      spotlightIntro:
        "With a median home value of $742K and a booming tech-driven economy, Wilsonville is one of the fastest-growing communities in the Portland metro. Here's what you need to know.",
      marketSnapshot:
        "Wilsonville's master-planned communities like Villebois, Canyon Creek, and Charbonneau offer a blend of new construction and established living. The city's proximity to major employers in the tech corridor, award-winning schools in the West Linn-Wilsonville district, and family-friendly amenities make it a magnet for young professionals and growing families.",
      marketSnapshotCta: 'Explore Neighborhoods',
      marketSnapshotLink: './neighborhoods.html',
      jumboTitle: 'Why Jumbo Matters in Wilsonville',
      jumboText:
        "With a median sale price near $742K, many Wilsonville purchases approach or exceed jumbo territory. Newer construction in Villebois and Canyon Creek often pushes past the $766,550 conforming limit. As an independent broker, we access wholesale jumbo rates that big banks can't match, and we'll find the sweet spot for your Wilsonville purchase.",
      jumboLink: './blog/jumbo-loans-west-linn.html',
      jumboCta: 'Read Our Jumbo Loan Guide',
      jumboCardText:
        "Wilsonville's $742K median is near jumbo territory. We specialize in finding the exact right loan for your budget and neighborhood.",
      testimonialSection: 'Trusted by Families Across the Portland Metro',
      communityTitle: 'Serving the Wilsonville Community',
      communityText:
        "We're more than a mortgage company. We serve Wilsonville, West Linn, and the entire south metro area with local expertise and personal attention. When you work with us, you're working with a neighbor who understands your market.",
      pageTitle: "Renegade Home Mortgage | Wilsonville, Oregon's Neighborhood Mortgage Expert",
    },
  };

  var area = areas[geo];
  if (!area) return;

  // ── Swap content using data-geo attributes ─────────────────────
  function swap(attr, value) {
    var el = document.querySelector('[data-geo="' + attr + '"]');
    if (el && value) {
      el.innerHTML = value;
    }
  }

  // Wait for DOM to be ready (script runs deferred)
  function apply() {
    // Simple text/HTML swaps
    swap('badge', area.badge);
    swap('headline', area.headline);
    swap('heroParagraph', area.heroParagraph);
    swap('spotlightTitle', area.spotlightTitle);
    swap('spotlightIntro', area.spotlightIntro);
    swap('marketSnapshot', area.marketSnapshot);
    swap('jumboTitle', area.jumboTitle);
    swap('jumboText', area.jumboText);
    swap('jumboCardText', area.jumboCardText);
    swap('testimonialSection', area.testimonialSection);
    swap('communityTitle', area.communityTitle);
    swap('communityText', area.communityText);

    // CTA buttons (replace full element)
    var msCta = document.querySelector('[data-geo="marketSnapshotCta"]');
    if (msCta && area.marketSnapshotCta) {
      msCta.textContent = area.marketSnapshotCta;
      if (area.marketSnapshotLink) msCta.href = area.marketSnapshotLink;
    }

    var jCta = document.querySelector('[data-geo="jumboCta"]');
    if (jCta && area.jumboCta) {
      jCta.textContent = area.jumboCta;
      if (area.jumboLink) jCta.href = area.jumboLink;
    }

    // Page title
    if (area.pageTitle) {
      document.title = area.pageTitle;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
