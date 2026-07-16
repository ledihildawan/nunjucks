export const TOGGLE_SCRIPT = `<script>
(function() {
  const initStackToggle = function() {
    const content = document.querySelector('#stack-container .stack-content');
    if (!content) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const allRows = Array.from(content.querySelectorAll('.stack-row'));
    const btn = document.getElementById('btn-toggle-stack');
    const VISIBLE_COUNT = 5;
    const totalHidden = allRows.length - VISIBLE_COUNT;

    if (totalHidden <= 0) {
      if (btn) btn.parentNode.removeChild(btn);
      return;
    }

    const hiddenRows = allRows.slice(VISIBLE_COUNT);
    hiddenRows.forEach((row) => { row.style.display = 'none'; });

    const lastVisibleRow = allRows[VISIBLE_COUNT - 1];
    if (lastVisibleRow) {
      lastVisibleRow.style.borderBottom = 'none';
    }

    const toggleStack = function() {
      if (prefersReducedMotion) {
        const isExpanded = content.classList.contains('is-expanded');
        hiddenRows.forEach((row) => { row.style.display = isExpanded ? 'none' : 'flex'; });
        content.classList.toggle('is-expanded');
        btn.textContent = isExpanded ? 'Show ' + totalHidden + ' more lines...' : 'Collapse stack trace';
        if (isExpanded) {
          if (lastVisibleRow) {
            lastVisibleRow.style.borderBottom = 'none';
          }
        } else {
          const lastRow = allRows.at(-1);
          if (lastRow) {
            lastRow.style.borderBottom = '';
          }
        }
        return;
      }

      const isExpanded = content.classList.contains('is-expanded');

      if (isExpanded) {
        content.style.removeProperty('max-height');
        content.classList.remove('is-expanded');
        btn.textContent = 'Show ' + totalHidden + ' more lines...';
        hiddenRows.forEach((row) => { row.style.display = 'none'; });
        if (lastVisibleRow) {
          lastVisibleRow.style.borderBottom = 'none';
        }
      } else {
        hiddenRows.forEach((row) => { row.style.display = 'flex'; });
        content.classList.add('is-expanded');
        btn.textContent = 'Collapse stack trace';
        const lastRow = allRows.at(-1);
        if (lastRow) {
          lastRow.style.borderBottom = '';
        }
      }
    };

    btn.addEventListener('click', toggleStack);
  };

  function batchRender(parent, nodes, index) {
    const BATCH_SIZE = 50;
    const end = Math.min(index + BATCH_SIZE, nodes.length);
    const fragment = document.createDocumentFragment();

    for (let i = index; i < end; i++) fragment.appendChild(nodes[i]);
    parent.appendChild(fragment);

    if (end < nodes.length) {
      requestAnimationFrame(function() { batchRender(parent, nodes, end); });
    }
  }

  function createNode(key, value) {
    const isObject = value !== null && typeof value === 'object';
    const row = document.createElement('div');
    row.className = 'ctx-row' + (isObject ? ' is-expandable' : '');

    if (isObject) {
      const isArray = Array.isArray(value);
      const label = isArray ? 'Array(' + value.length + ')' : 'Object';
      row.innerHTML = '<span class="ctx-toggle">▶</span><span class="ctx-key">' + escapeHtml(key) + ':</span> <span class="ctx-label">' + label + '</span>';

      const container = document.createElement('div');
      container.className = 'ctx-indent hidden';

      let loaded = false;

      row.onclick = function() {
        const isHidden = container.classList.toggle('hidden');
        row.querySelector('.ctx-toggle').textContent = isHidden ? '▶' : '▼';

        if (!isHidden && !loaded) {
          const entries = Object.entries(value);
          if (entries.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'ctx-row';
            emptyMsg.style.color = 'var(--color-text-secondary)';
            emptyMsg.style.fontStyle = 'italic';
            emptyMsg.textContent = '(empty)';
            container.appendChild(emptyMsg);
          } else {
            const nodes = entries.map((entry) => createNode(entry[0], entry[1]));
            batchRender(container, nodes, 0);
          }
          loaded = true;
        }
      };

      const wrapper = document.createElement('div');
      wrapper.appendChild(row);
      wrapper.appendChild(container);
      return wrapper;
    } else {
      const type = typeof value;
      const displayVal = type === 'string' ? '"' + escapeHtml(value) + '"' : String(value);
      row.innerHTML = '<span class="ctx-toggle"></span><span class="ctx-key">' + escapeHtml(key) + ':</span> <span class="ctx-' + type + '">' + displayVal + '</span>';
      return row;
    }
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function initContextToggle() {
    const viewer = document.getElementById('ctx-tree');
    if (!viewer) return;

    const data = window.__ctxData;
    if (!data) return;

    Object.entries(data).forEach((entry) => {
      const node = createNode(entry[0], entry[1]);
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
</script>`;
