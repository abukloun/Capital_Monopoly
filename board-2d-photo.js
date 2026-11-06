/* CAPITAL — 2D board look (companion to board-2d-photo.css).
   1) flat board: price text "$60" -> "60$" (like the reference photo)
   2) purchase window: price "$220" -> "220$" and the country's round flag in the header.
   Game data and logic are not touched. */
(function () {
  var re = /^\$\s?(\d[\d,.\s]*)$/;
  function flip(el) {
    var m = re.exec((el.textContent || '').trim());
    if (m) el.textContent = m[1].trim() + '$';
  }
  function fixBoard() {
    var list = document.querySelectorAll('#board .tile .price');
    for (var i = 0; i < list.length; i++) flip(list[i]);
  }
  function fixModal() {
    var root = document.getElementById('modalRoot');
    if (!root) return;
    var modals = root.querySelectorAll('.capital-property-modal:not(.capital-property-modal-2d)');
    for (var i = 0; i < modals.length; i++) {
      var m = modals[i];
      var price = m.querySelector('.capital-property-price');
      if (price) flip(price);
      var hero = m.querySelector('.capital-property-hero');
      if (hero && !hero.querySelector('.bm-flag')) {
        var bg = m.closest('.modal-bg');
        var id = bg && bg.getAttribute('data-tile-id');
        var f = id != null && document.querySelector('#tile-' + id + ' .city-flag');
        var emo = f && f.getAttribute('aria-label');
        if (emo) {
          var s = document.createElement('span');
          s.className = 'bm-flag';
          s.setAttribute('data-flag', emo);
          hero.appendChild(s);
        }
      }
    }
  }
  function overflows(n, tile) {
    if (n.scrollWidth > n.clientWidth + 1) return true;
    var tr = tile.getBoundingClientRect();
    var kids = tile.querySelectorAll('.name, .price, .tile-icon');
    var rects = [];
    for (var i = 0; i < kids.length; i++) {
      var r = kids[i].getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (r.left < tr.left - 1 || r.right > tr.right + 1 || r.top < tr.top - 1 || r.bottom > tr.bottom + 1) return true;
      rects.push(r);
    }
    for (var a = 0; a < rects.length; a++) {
      for (var b2 = a + 1; b2 < rects.length; b2++) {
        var p = rects[a], q = rects[b2];
        if (p.left < q.right - 1 && q.left < p.right - 1 && p.top < q.bottom - 1 && q.top < p.bottom - 1) return true;
      }
    }
    return false;
  }
  /* Shrinks a tile name only when it does not fit, whatever font ends up loaded. */
  function fitNames() {
    var board = document.getElementById('board');
    if (!board || board.offsetParent === null) return;
    var names = board.querySelectorAll('.tile .name');
    var i, n;
    for (i = 0; i < names.length; i++) names[i].style.removeProperty('font-size');
    for (i = 0; i < names.length; i++) {
      n = names[i];
      var tile = n.closest('.tile');
      var size = parseFloat(getComputedStyle(n).fontSize);
      var guard = 0;
      while (guard++ < 24 && size > 7 && overflows(n, tile)) {
        size -= 0.5;
        n.style.setProperty('font-size', size + 'px', 'important');
      }
    }
  }
  var fitTimer = null;
  function scheduleFit() { clearTimeout(fitTimer); fitTimer = setTimeout(fitNames, 60); }
  function start() {
    var b = document.getElementById('board');
    if (b) {
      fixBoard();
      new MutationObserver(function (muts) {
        fixBoard();
        for (var k = 0; k < muts.length; k++) {
          var t = muts[k].target;
          if (muts[k].type === 'childList' && t === b) { scheduleFit(); break; }
          if (t.nodeType === 1 && t.closest && t.closest('.name')) { scheduleFit(); break; }
        }
      }).observe(b, { childList: true, subtree: true, characterData: true });
      if (window.ResizeObserver) new ResizeObserver(scheduleFit).observe(b);
      window.addEventListener('resize', scheduleFit);
      if (document.fonts) { document.fonts.ready.then(scheduleFit); document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', scheduleFit); }
      scheduleFit();
    }
    var r = document.getElementById('modalRoot');
    if (r) {
      fixModal();
      new MutationObserver(fixModal).observe(r, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
