export const TOGGLE_SCRIPT = `
(function() {
  var initStackToggle = function() {
    var content = document.querySelector('#stack-container .stack-content');
    if (!content) return;

    var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var allRows = Array.from(content.querySelectorAll('.stack-row'));
    var btn = document.getElementById('btn-toggle-stack');
    var VISIBLE_COUNT = 5;
    var totalHidden = allRows.length - VISIBLE_COUNT;

    if (totalHidden <= 0) {
      if (btn) btn.parentNode.removeChild(btn);
      return;
    }

    var hiddenRows = allRows.slice(VISIBLE_COUNT);
    hiddenRows.forEach(function(row) { row.style.display = 'none'; });

    var toggleStack = function() {
      if (prefersReducedMotion) {
        var isExpanded = content.classList.contains('is-expanded');
        hiddenRows.forEach(function(row) { row.style.display = isExpanded ? 'none' : 'flex'; });
        content.classList.toggle('is-expanded');
        btn.textContent = isExpanded ? 'Show ' + totalHidden + ' more lines...' : 'Collapse stack trace';
        return;
      }

      var isExpanded = content.classList.contains('is-expanded');

      if (isExpanded) {
        content.style.removeProperty('max-height');
        content.classList.remove('is-expanded');
        btn.textContent = 'Show ' + totalHidden + ' more lines...';
        hiddenRows.forEach(function(row) { row.style.display = 'none'; });
      } else {
        hiddenRows.forEach(function(row) { row.style.display = 'flex'; });
        content.classList.add('is-expanded');
        btn.textContent = 'Collapse stack trace';
      }
    };

    btn.addEventListener('click', toggleStack);
  };

  function batchRender(parent, nodes, index) {
    var BATCH_SIZE = 50;
    var end = Math.min(index + BATCH_SIZE, nodes.length);
    var fragment = document.createDocumentFragment();

    for (var i = index; i < end; i++) fragment.appendChild(nodes[i]);
    parent.appendChild(fragment);

    if (end < nodes.length) {
      requestAnimationFrame(function() { batchRender(parent, nodes, end); });
    }
  }

  function createNode(key, value) {
    var isObject = value !== null && typeof value === 'object';
    var row = document.createElement('div');
    row.className = 'ctx-row' + (isObject ? ' is-expandable' : '');

    if (isObject) {
      var isArray = Array.isArray(value);
      var label = isArray ? 'Array(' + value.length + ')' : 'Object';
      row.innerHTML = '<span class="ctx-toggle">▶</span><span class="ctx-key">' + escapeHtml(key) + ':</span> <span class="ctx-label">' + label + '</span>';

      var container = document.createElement('div');
      container.className = 'ctx-indent hidden';

      var loaded = false;

      row.onclick = function() {
        var isHidden = container.classList.toggle('hidden');
        row.querySelector('.ctx-toggle').textContent = isHidden ? '▶' : '▼';

        if (!isHidden && !loaded) {
          var entries = Object.entries(value);
          if (entries.length === 0) {
            var emptyMsg = document.createElement('div');
            emptyMsg.className = 'ctx-row';
            emptyMsg.style.color = 'var(--color-text-secondary)';
            emptyMsg.style.fontStyle = 'italic';
            emptyMsg.textContent = '(empty)';
            container.appendChild(emptyMsg);
          } else {
            var nodes = entries.map(function(entry) { return createNode(entry[0], entry[1]); });
            batchRender(container, nodes, 0);
          }
          loaded = true;
        }
      };

      var wrapper = document.createElement('div');
      wrapper.appendChild(row);
      wrapper.appendChild(container);
      return wrapper;
    } else {
      var type = typeof value;
      var displayVal = type === 'string' ? '"' + escapeHtml(value) + '"' : String(value);
      row.innerHTML = '<span class="ctx-toggle"></span><span class="ctx-key">' + escapeHtml(key) + ':</span> <span class="ctx-' + type + '">' + displayVal + '</span>';
      return row;
    }
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function initContextToggle() {
    var viewer = document.getElementById('ctx-tree');
    if (!viewer) return;

    var data = window.__ctxData;
    if (!data) return;

    Object.entries(data).forEach(function(entry) {
      var node = createNode(entry[0], entry[1]);
      viewer.appendChild(node);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initStackToggle();
      initContextToggle();
    });
  } else {
    initStackToggle();
    initContextToggle();
  }
})();
`;
