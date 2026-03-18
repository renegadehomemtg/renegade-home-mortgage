/* ============================================================
   RENEGADE HOME MORTGAGE - Shared JavaScript
   ============================================================ */

(function () {
  'use strict';

  /* --- Dark/Light Mode Toggle (default: DARK) --- */
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let currentTheme = 'dark'; // Default to dark
  root.setAttribute('data-theme', currentTheme);
  updateToggleIcon();

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', currentTheme);
      themeToggle.setAttribute('aria-label', 'Switch to ' + (currentTheme === 'dark' ? 'light' : 'dark') + ' mode');
      updateToggleIcon();
    });
  }

  function updateToggleIcon() {
    if (!themeToggle) return;
    themeToggle.innerHTML = currentTheme === 'dark'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  /* --- Sticky Header with Scroll Behavior --- */
  const header = document.querySelector('.header');
  let lastScroll = 0;

  if (header) {
    window.addEventListener('scroll', () => {
      const currentScroll = window.scrollY;
      if (currentScroll > 100) {
        header.classList.add('header--scrolled');
      } else {
        header.classList.remove('header--scrolled');
      }
      if (currentScroll > lastScroll && currentScroll > 300) {
        header.classList.add('header--hidden');
      } else {
        header.classList.remove('header--hidden');
      }
      lastScroll = currentScroll;
    }, { passive: true });
  }

  /* --- Mobile Menu Toggle --- */
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const mobileNav = document.querySelector('.mobile-nav');

  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('active');
      mobileMenuBtn.setAttribute('aria-expanded', isOpen);
      mobileMenuBtn.innerHTML = isOpen
        ? '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>'
        : '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>';
    });
  }

  /* --- FAQ Accordion --- */
  document.querySelectorAll('.faq-item__question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const wasActive = item.classList.contains('active');
      // Close all in this group
      item.parentElement.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      if (!wasActive) {
        item.classList.add('active');
      }
    });
  });

  /* --- Scroll Reveal --- */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    reveals.forEach(el => observer.observe(el));
  }

  /* --- App Screenshot Carousel --- */
  (function initCarousel() {
    var track = document.querySelector('.app-carousel__track');
    var slides = document.querySelectorAll('.app-carousel__slide');
    var dotsContainer = document.querySelector('.app-carousel__dots');
    var leftArrow = document.querySelector('.app-carousel__arrow--left');
    var rightArrow = document.querySelector('.app-carousel__arrow--right');
    if (!track || slides.length === 0) return;

    var current = 0;
    var total = slides.length;
    var autoPlayTimer = null;

    // Build dot indicators
    for (var i = 0; i < total; i++) {
      var dot = document.createElement('button');
      dot.className = 'app-carousel__dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', 'Go to screen ' + (i + 1));
      dot.dataset.index = i;
      dot.addEventListener('click', function() { goTo(parseInt(this.dataset.index)); });
      dotsContainer.appendChild(dot);
    }

    function updateSlides() {
      slides.forEach(function(s, idx) {
        s.classList.remove('active', 'adjacent');
        if (idx === current) s.classList.add('active');
        else if (Math.abs(idx - current) === 1) s.classList.add('adjacent');
      });
      // Update dots
      var dots = dotsContainer.querySelectorAll('.app-carousel__dot');
      dots.forEach(function(d, idx) {
        d.classList.toggle('active', idx === current);
      });
      // Center the active slide in the track
      centerSlide();
    }

    function centerSlide() {
      var wrapper = document.querySelector('.app-carousel__track-wrapper');
      if (!wrapper) return;
      var wrapperWidth = wrapper.offsetWidth;
      var slide = slides[current];
      var slideWidth = slide.offsetWidth;
      var gap = parseInt(getComputedStyle(track).gap) || 20;
      var offset = 0;
      for (var i = 0; i < current; i++) {
        offset += slides[i].offsetWidth + gap;
      }
      var center = offset + slideWidth / 2;
      var shift = center - wrapperWidth / 2;
      track.style.transform = 'translateX(' + (-Math.max(0, shift)) + 'px)';
    }

    function goTo(idx) {
      current = ((idx % total) + total) % total;
      updateSlides();
      resetAutoPlay();
    }

    function next() { goTo(current + 1); }
    function prev() { goTo(current - 1); }

    if (leftArrow) leftArrow.addEventListener('click', prev);
    if (rightArrow) rightArrow.addEventListener('click', next);

    // Click on slide to navigate
    slides.forEach(function(s, idx) {
      s.addEventListener('click', function() { goTo(idx); });
    });

    // Touch/swipe support
    var touchStartX = 0;
    var touchEndX = 0;
    track.addEventListener('touchstart', function(e) { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    track.addEventListener('touchend', function(e) {
      touchEndX = e.changedTouches[0].screenX;
      var diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 40) {
        if (diff > 0) next(); else prev();
      }
    }, { passive: true });

    // Auto-play
    function resetAutoPlay() {
      if (autoPlayTimer) clearInterval(autoPlayTimer);
      autoPlayTimer = setInterval(next, 4000);
    }

    // Pause on hover
    var carouselEl = document.querySelector('.app-carousel');
    if (carouselEl) {
      carouselEl.addEventListener('mouseenter', function() { if (autoPlayTimer) clearInterval(autoPlayTimer); });
      carouselEl.addEventListener('mouseleave', resetAutoPlay);
    }

    // Initial state
    updateSlides();
    resetAutoPlay();

    // Recalculate on resize
    window.addEventListener('resize', function() { centerSlide(); });
  })();

  /* --- Get the App Form (PAM API) --- */
  var getAppForm = document.getElementById('get-app-form');
  if (getAppForm) {
    getAppForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var submitBtn = document.getElementById('get-app-submit');
      var textEl = submitBtn.querySelector('.get-app-form__submit-text');
      var loadingEl = submitBtn.querySelector('.get-app-form__submit-loading');
      var successEl = document.getElementById('get-app-success');
      var errorEl = document.getElementById('get-app-error');

      // Show loading state
      textEl.style.display = 'none';
      loadingEl.style.display = 'inline-flex';
      submitBtn.disabled = true;
      errorEl.style.display = 'none';

      var turnstileInput = document.querySelector('[name="cf-turnstile-response"]');
      var turnstileToken = turnstileInput ? turnstileInput.value : '';
      if (!turnstileToken) {
        errorEl.style.display = 'block';
        textEl.style.display = 'inline';
        loadingEl.style.display = 'none';
        submitBtn.disabled = false;
        return;
      }

      var payload = {
        first_name: document.getElementById('app-first-name').value.trim(),
        last_name: document.getElementById('app-last-name').value.trim(),
        email: document.getElementById('app-email').value.trim(),
        phone: document.getElementById('app-phone').value.trim().replace(/[^\d+]/g, ''),
        'cf-turnstile-response': turnstileToken
      };

      fetch('/api/get-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      .then(function(resp) { return resp.json(); })
      .then(function(data) {
        if (data.success) {
          getAppForm.style.display = 'none';
          successEl.style.display = 'block';
          // Google Ads conversion tracking
          if (typeof gtag === 'function') {
            gtag('event', 'conversion', {
              'send_to': 'AW-18025235354/get_app_lead',
              'event_callback': function() {}
            });
          }
        } else {
          errorEl.style.display = 'block';
          textEl.style.display = 'inline';
          loadingEl.style.display = 'none';
          submitBtn.disabled = false;
        }
      })
      .catch(function() {
        errorEl.style.display = 'block';
        textEl.style.display = 'inline';
        loadingEl.style.display = 'none';
        submitBtn.disabled = false;
        if (typeof turnstile !== 'undefined') turnstile.reset();
      });
    });
  }

  /* --- Contact Form (frontend only) --- */
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const successMsg = document.getElementById('form-success');
      if (successMsg) {
        successMsg.style.display = 'block';
        contactForm.reset();
        setTimeout(() => { successMsg.style.display = 'none'; }, 5000);
      }
    });
  }

})();
