/* ============================================================
   RENEGADE AIO MASTER CLASS — Chart & Form Logic
   ============================================================ */

(function() {
  'use strict';

  /* --- Amortization Chart --- */
  function drawAmortChart() {
    const canvas = document.getElementById('amort-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    const pad = { top: 20, right: 20, bottom: 40, left: 60 };
    const plotW = W - pad.left - pad.right;
    const plotH = H - pad.top - pad.bottom;

    // Amortization calc: $500K, 6.5%, 30yr
    const principal = 500000;
    const annualRate = 0.065;
    const monthlyRate = annualRate / 12;
    const totalMonths = 360;
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) /
                           (Math.pow(1 + monthlyRate, totalMonths) - 1);

    // Calculate yearly interest and principal portions
    const years = 30;
    const yearlyInterest = [];
    const yearlyPrincipal = [];
    let balance = principal;

    for (let y = 0; y < years; y++) {
      let yearInt = 0;
      let yearPrin = 0;
      for (let m = 0; m < 12; m++) {
        const intPayment = balance * monthlyRate;
        const prinPayment = monthlyPayment - intPayment;
        yearInt += intPayment;
        yearPrin += prinPayment;
        balance -= prinPayment;
      }
      yearlyInterest.push(yearInt);
      yearlyPrincipal.push(yearPrin);
    }

    const maxVal = Math.max(...yearlyInterest, ...yearlyPrincipal) * 1.1;
    const barGroupWidth = plotW / years;
    const barWidth = barGroupWidth * 0.35;
    const gap = barGroupWidth * 0.1;

    // Background
    ctx.fillStyle = 'transparent';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + (plotH / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }

    // Y-axis labels
    ctx.fillStyle = '#6B7280';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= gridLines; i++) {
      const val = maxVal - (maxVal / gridLines) * i;
      const y = pad.top + (plotH / gridLines) * i;
      ctx.fillText('$' + Math.round(val / 1000) + 'K', pad.left - 8, y);
    }

    // X-axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let y = 0; y < years; y += 5) {
      const x = pad.left + barGroupWidth * y + barGroupWidth / 2;
      ctx.fillText('Yr ' + (y + 1), x, H - pad.bottom + 10);
    }
    // Last year label
    ctx.fillText('Yr 30', pad.left + barGroupWidth * 29 + barGroupWidth / 2, H - pad.bottom + 10);

    // Draw bars
    for (let y = 0; y < years; y++) {
      const x = pad.left + barGroupWidth * y + gap;

      // Interest bar (red)
      const intH = (yearlyInterest[y] / maxVal) * plotH;
      ctx.fillStyle = '#E63946';
      ctx.beginPath();
      roundRect(ctx, x, pad.top + plotH - intH, barWidth, intH, 2);
      ctx.fill();

      // Principal bar (green)
      const prinH = (yearlyPrincipal[y] / maxVal) * plotH;
      ctx.fillStyle = '#34D399';
      ctx.beginPath();
      roundRect(ctx, x + barWidth + 1, pad.top + plotH - prinH, barWidth, prinH, 2);
      ctx.fill();
    }

    // Legend
    const legendY = pad.top - 2;
    ctx.fillStyle = '#E63946';
    ctx.fillRect(W - pad.right - 180, legendY, 10, 10);
    ctx.fillStyle = '#9CA3AF';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Interest', W - pad.right - 165, legendY + 5);

    ctx.fillStyle = '#34D399';
    ctx.fillRect(W - pad.right - 90, legendY, 10, 10);
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText('Principal', W - pad.right - 75, legendY + 5);
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (h < 1) return;
    r = Math.min(r, h / 2, w / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Draw on load and resize
  window.addEventListener('DOMContentLoaded', drawAmortChart);
  window.addEventListener('resize', debounce(drawAmortChart, 200));

  function debounce(fn, ms) {
    let t;
    return function() {
      clearTimeout(t);
      t = setTimeout(fn, ms);
    };
  }

  /* --- Form Submission --- */
  document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('mc-enroll-form');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      const submitBtn = document.getElementById('mc-submit-btn');
      const submitText = document.getElementById('mc-submit-text');
      const submitLoading = document.getElementById('mc-submit-loading');
      const successDiv = document.getElementById('mc-form-success');
      const errorDiv = document.getElementById('mc-form-error');

      // Get Turnstile token
      const turnstileResponse = document.querySelector('[name="cf-turnstile-response"]');
      const token = turnstileResponse ? turnstileResponse.value : '';

      if (!token) {
        errorDiv.style.display = 'block';
        errorDiv.querySelector('p').textContent = 'Please complete the security check.';
        return;
      }

      // Disable and show loading
      submitBtn.disabled = true;
      submitText.style.display = 'none';
      submitLoading.style.display = 'inline-flex';
      errorDiv.style.display = 'none';

      const formData = {
        first_name: form.first_name.value.trim(),
        last_name: form.last_name.value.trim(),
        email: form.email.value.trim(),
        phone: form.phone.value.trim(),
        turnstile_token: token,
        source: 'masterclass'
      };

      try {
        const res = await fetch('/api/masterclass-enroll', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        if (!res.ok) throw new Error('Server error');

        const data = await res.json();

        // Show success
        form.style.display = 'none';
        successDiv.style.display = 'block';

        // Store enrollment in localStorage for gating
        localStorage.setItem('mc_enrolled', 'true');
        localStorage.setItem('mc_name', formData.first_name);
        localStorage.setItem('mc_email', formData.email);

        // Track conversion
        if (typeof gtag === 'function') {
          gtag('event', 'conversion', {
            send_to: 'AW-18025235354',
            event_category: 'masterclass',
            event_label: 'enrollment'
          });
        }

        // Redirect to Module 1 after 2 seconds
        setTimeout(function() {
          window.location.href = './masterclass/module-1.html';
        }, 2000);

      } catch (err) {
        submitBtn.disabled = false;
        submitText.style.display = 'inline';
        submitLoading.style.display = 'none';
        errorDiv.style.display = 'block';
        errorDiv.querySelector('p').innerHTML = 'Something went wrong. Please try again or call us at <a href="tel:+15039743571">(503) 974-3571</a>.';
      }
    });
  });

})();
