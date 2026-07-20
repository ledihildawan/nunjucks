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
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function valueType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  function previewValue(value) {
    if (Array.isArray(value)) {
      if (value.length === 0) return '[]';
      const preview = value.slice(0, 3).map(function(v) {
        if (typeof v === 'string') return '"' + (v.length > 40 ? v.substring(0, 40) + '...' : v) + '"';
        if (v !== null && typeof v === 'object') return Array.isArray(v) ? '[...]' : '{...}';
        return String(v);
      }).join(', ');
      return '(' + value.length + ') [' + preview + (value.length > 3 ? ', ...' : '') + ']';
    }
    if (value !== null && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      const preview = keys.slice(0, 3).map(function(k) {
        const v = value[k];
        const vStr = typeof v === 'string' ? '"' + (v.length > 40 ? v.substring(0, 40) + '...' : v) + '"' :
          (v !== null && typeof v === 'object' ? (Array.isArray(v) ? '[...]' : '{...}') : String(v));
        return k + ': ' + vStr;
      }).join(', ');
      return '{' + preview + (keys.length > 3 ? ', ...' : '') + '}';
    }
    if (typeof value === 'string') {
      const truncated = value.length > 40 ? value.substring(0, 40) + '...' : value;
      return '"' + truncated + '"';
    }
    return String(value);
  }

  function createNode(key, value) {
    const isObject = value !== null && typeof value === 'object';
    const isEmpty = isObject && (
      Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
    );
    const isExpandable = isObject && !isEmpty;

    const row = document.createElement('div');
    row.className = 'ctx-row' + (isExpandable ? ' is-expandable' : '');

    if (isExpandable) {
      const isArray = Array.isArray(value);
      const openBracket = isArray ? '[' : '{';
      const closeBracket = isArray ? ']' : '}';

      row.setAttribute('role', 'button');
      row.setAttribute('tabindex', '0');
      row.setAttribute('aria-expanded', 'false');
      row.innerHTML = '<span class="ctx-toggle">\u25B6</span><span class="ctx-key">' + escapeHtml(key) + ':</span> <span class="ctx-label">' + escapeHtml(previewValue(value)) + '</span>';

      const container = document.createElement('div');
      container.className = 'ctx-children hidden';
      let loaded = false;

      const closing = document.createElement('div');
      closing.className = 'ctx-closing hidden';
      closing.textContent = closeBracket;

      const toggle = function() {
        const isHidden = container.classList.toggle('hidden');
        const toggleEl = row.querySelector('.ctx-toggle');
        const labelEl = row.querySelector('.ctx-label');
        row.setAttribute('aria-expanded', isHidden ? 'false' : 'true');
        if (labelEl) labelEl.textContent = isHidden ? escapeHtml(previewValue(value)) : openBracket;
        closing.classList.toggle('hidden', isHidden);

        if (!isHidden && !loaded) {
          const entries = Object.entries(value);
          const nodes = entries.map(function(entry) { return createNode(entry[0], entry[1]); });
          batchRender(container, nodes, 0);
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
      wrapper.className = 'ctx-node';
      wrapper.appendChild(row);
      wrapper.appendChild(container);
      wrapper.appendChild(closing);
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

    const opening = document.createElement('div');
    opening.className = 'ctx-row ctx-bracket';
    opening.innerHTML = '<span class="ctx-label">{</span>';
    viewer.appendChild(opening);

    const container = document.createElement('div');
    container.className = 'ctx-children';
    Object.entries(data).forEach((entry) => {
      const node = createNode(entry[0], entry[1]);
      container.appendChild(node);
    });
    viewer.appendChild(container);

    const closing = document.createElement('div');
    closing.className = 'ctx-row ctx-bracket';
    closing.innerHTML = '<span class="ctx-label">}</span>';
    viewer.appendChild(closing);

    const expandButton = document.querySelector('[data-ctx-action="expand"]');
    const collapseButton = document.querySelector('[data-ctx-action="collapse"]');

    const updateContextActions = function() {
      const expandableRows = Array.from(viewer.querySelectorAll('.ctx-row.is-expandable'));
      const expandedCount = expandableRows.filter(function(row) {
        return row.getAttribute('aria-expanded') === 'true';
      }).length;
      if (expandButton) expandButton.disabled = expandableRows.length === 0 || expandedCount === expandableRows.length;
      if (collapseButton) collapseButton.disabled = expandedCount === 0;
    };

    const expandAll = function(root) {
      Array.from(root.querySelectorAll('.ctx-row.is-expandable')).forEach(function(row) {
        if (row.getAttribute('aria-expanded') !== 'true') row.click();
      });
      const stillHasCollapsed = Array.from(root.querySelectorAll('.ctx-row.is-expandable')).some(function(row) {
        return row.getAttribute('aria-expanded') !== 'true';
      });
      if (stillHasCollapsed) {
        requestAnimationFrame(function() { expandAll(root); });
      } else {
        updateContextActions();
      }
    };

    const collapseAll = function(root) {
      Array.from(root.querySelectorAll('.ctx-row.is-expandable')).reverse().forEach(function(row) {
        if (row.getAttribute('aria-expanded') === 'true') row.click();
      });
      updateContextActions();
    };

    viewer.addEventListener('click', function(event) {
      if (event.target.closest('.ctx-row.is-expandable')) requestAnimationFrame(updateContextActions);
    });
    updateContextActions();

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
