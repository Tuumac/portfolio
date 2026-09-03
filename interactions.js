(function () {
  var revealEls = document.querySelectorAll('.reveal');
  var statEls = document.querySelectorAll('.stat-number[data-target]');

  function animateCount(el) {
    var target = parseFloat(el.getAttribute('data-target'));
    var suffix = el.getAttribute('data-suffix') || '';
    var duration = 1200;
    var start = null;

    function step(timestamp) {
      if (start === null) start = timestamp;
      var progress = Math.min((timestamp - start) / duration, 1);
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased) + suffix;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      if (entry.target.classList.contains('stat-number')) {
        animateCount(entry.target);
      }
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.15 });

  revealEls.forEach(function (el) { observer.observe(el); });
  statEls.forEach(function (el) { observer.observe(el); });
})();
