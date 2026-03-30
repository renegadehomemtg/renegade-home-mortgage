/* Gate check: redirect unenrolled visitors to the landing page */
(function() {
  'use strict';
  var enrolled = localStorage.getItem('mc_enrolled');
  if (enrolled !== 'true') {
    var overlay = document.getElementById('mc-gate-overlay');
    if (overlay) overlay.style.display = 'flex';
    setTimeout(function() {
      window.location.href = '../masterclass.html#enroll';
    }, 3000);
  } else {
    var overlay = document.getElementById('mc-gate-overlay');
    if (overlay) overlay.style.display = 'none';
    // Set the user's name if available
    var name = localStorage.getItem('mc_name');
    var nameEl = document.getElementById('mc-user-name');
    if (name && nameEl) nameEl.textContent = name;
  }
})();
