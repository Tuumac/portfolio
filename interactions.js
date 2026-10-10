(function () {
  var revealEls = document.querySelectorAll('.reveal');
  var statEls = document.querySelectorAll('[data-target]');
  var industryEls = document.querySelectorAll('.industry[data-start]');
  var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function parseMonth(value) {
    if (value === 'present') {
      var now = new Date();
      return { y: now.getFullYear(), m: now.getMonth() + 1 };
    }
    var parts = value.split('-');
    return { y: parseInt(parts[0], 10), m: parseInt(parts[1], 10) };
  }

  function monthsBetween(start, end) {
    return (end.y - start.y) * 12 + (end.m - start.m) + 1;
  }

  function setYearsAndBars() {
    var spans = [];
    var maxMonths = 0;

    industryEls.forEach(function (el) {
      var start = parseMonth(el.getAttribute('data-start'));
      var end = parseMonth(el.getAttribute('data-end'));
      var months = monthsBetween(start, end);
      maxMonths = Math.max(maxMonths, months);
      spans.push({ el: el, months: months });
    });

    spans.forEach(function (item) {
      var years = (item.months / 12).toFixed(1);
      var numEl = item.el.querySelector('.industry__num');
      var barEl = item.el.querySelector('.industry__bar span');
      if (numEl) numEl.textContent = years;
      if (barEl) barEl.style.width = (item.months / maxMonths * 100) + '%';
    });
  }

  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-target'));
    var suffix = el.getAttribute('data-suffix') || '';

    if (reducedMotion) {
      el.textContent = Math.round(target).toLocaleString('en-US') + suffix;
      return;
    }

    var duration = 1200;
    var start = null;

    function step(timestamp) {
      if (start === null) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased).toLocaleString('en-US') + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      if (entry.target.hasAttribute('data-target')) {
        animateCount(entry.target);
      }
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15 });

  setYearsAndBars();
  revealEls.forEach(function (el) { observer.observe(el); });
  statEls.forEach(function (el) { observer.observe(el); });
})();
