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

  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function valueType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  function previewValue(value) {
    if (Array.isArray(value)) return 'Array(' + value.length + ')';
    if (value !== null && typeof value === 'object') return 'Object(' + Object.keys(value).length + ')';
    if (typeof value === 'string') return '"' + value + '"';
    return String(value);
  }

  function createNode(key, value) {
    const isObject = value !== null && typeof value === 'object';
    const row = document.createElement('div');
    row.className = 'ctx-row' + (isObject ? ' is-expandable' : '');

    if (isObject) {
      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-expanded', 'false');
      row.innerHTML = '<span class="ctx-toggle">+</span><span class="ctx-key">' + escapeHtml(key) + ':</span> <span class="ctx-label">' + escapeHtml(previewValue(value)) + '</span>';

      const container = document.createElement('div');
      container.className = 'ctx-indent hidden';
      let loaded = false;

      const toggle = function() {
        const isHidden = container.classList.toggle('hidden');
        const toggleEl = row.querySelector('.ctx-toggle');
        row.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
        if (toggleEl) toggleEl.textContent = isHidden ? '+' : '-';

        if (!isHidden && !loaded) {
          const entries = Object.entries(value);
          if (entries.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'ctx-row is-empty';
            emptyMsg.textContent = '(empty)';
            container.appendChild(emptyMsg);
          } else {
            const nodes = entries.map((entry) => createNode(entry[0], entry[1]));
            batchRender(container, nodes, 0);
          }
          loaded = true;
        }
      };

      row.addEventListener('click', toggle);
      row.addEventListener('keydown', function(event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          toggle();
        }
      });

      const wrapper = document.createElement('div');
      wrapper.appendChild(row);
      wrapper.appendChild(container);
      return wrapper;
    }

    const type = valueType(value);
    const displayVal = escapeHtml(previewValue(value));
    row.innerHTML = '<span class="ctx-toggle"></span><span class="ctx-key">' + escapeHtml(key) + ':</span> <span class="ctx-' + type + '">' + displayVal + '</span>';
    return row;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.inset = '0 auto auto 0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    } finally {
      document.body.removeChild(textarea);
    }
  }

  function initContextToggle() {
    const viewer = document.getElementById('ctx-tree');
    if (!viewer) return;

    const dataEl = document.getElementById('ctx-data');
    if (!dataEl) return;

    let data;
    try {
      data = JSON.parse(dataEl.textContent || '{}');
    } catch (error) {
      viewer.textContent = 'Render context is not valid JSON.';
      return;
    }
    if (!data) return;

    Object.entries(data).forEach((entry) => {
      const node = createNode(entry[0], entry[1]);
      viewer.appendChild(node);
    });

    const expandAll = function(root) {
      Array.from(root.querySelectorAll('.ctx-row.is-expandable')).forEach(function(row) {
        if (row.getAttribute('aria-expanded') !== 'true') row.click();
      });
      const stillHasCollapsed = Array.from(root.querySelectorAll('.ctx-row.is-expandable')).some(function(row) {
        return row.getAttribute('aria-expanded') !== 'true';
      });
      if (stillHasCollapsed) requestAnimationFrame(function() { expandAll(root); });
    };

    const collapseAll = function(root) {
      Array.from(root.querySelectorAll('.ctx-row.is-expandable')).reverse().forEach(function(row) {
        if (row.getAttribute('aria-expanded') === 'true') row.click();
      });
    };

    document.querySelectorAll('[data-ctx-action]').forEach(function(button) {
      button.addEventListener('click', function() {
        const action = button.getAttribute('data-ctx-action');
        if (action === 'expand') expandAll(viewer);
        if (action === 'collapse') collapseAll(viewer);
        if (action === 'copy') {
          const original = button.textContent;
          copyText(JSON.stringify(data, null, 2)).then(function() {
            button.textContent = 'Copied';
            setTimeout(function() { button.textContent = original; }, 1200);
          }).catch(function() {
            button.textContent = 'Copy failed';
            setTimeout(function() { button.textContent = original; }, 1200);
          });
        }
      });
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
