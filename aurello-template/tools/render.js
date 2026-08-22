'use strict';
/*
 * Minimal Mustache-subset renderer. Deliberately tiny and dependency-free so the
 * template can be built anywhere Node runs.
 *
 * Supported:
 *   {{path.to.value}}    HTML-escaped interpolation
 *   {{{path.to.value}}}  raw interpolation (trusted HTML from the brand file)
 *   {{#path}}...{{/path}}  section: array -> loop, object -> push scope, truthy -> keep
 *   {{^path}}...{{/path}}  inverted section: empty array / falsy -> keep
 *   {{.}}                 the current item inside a loop over primitives
 *   {{@index}} {{@n}} {{@count}}  0-based index, 2-digit 1-based index, array length
 *   {{! comment }}
 */

const TAG = /\{\{\{\s*([^}]+?)\s*\}\}\}|\{\{\s*([#^/!&]?)\s*([^}]*?)\s*\}\}/g;

function parse(input) {
  const root = { children: [] };
  const stack = [root];
  let last = 0;
  let m;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(input)) !== null) {
    const top = stack[stack.length - 1];
    if (m.index > last) top.children.push({ t: 'text', v: input.slice(last, m.index) });
    last = TAG.lastIndex;

    if (m[1] !== undefined) { top.children.push({ t: 'raw', v: m[1] }); continue; }

    const sigil = m[2];
    const name = m[3];
    if (sigil === '!') continue;
    if (sigil === '#' || sigil === '^') {
      const node = { t: sigil === '#' ? 'section' : 'inverted', v: name, children: [] };
      top.children.push(node);
      stack.push(node);
    } else if (sigil === '/') {
      const closing = stack.pop();
      if (!closing || closing.v !== name) {
        throw new Error(`Template: unbalanced tag {{/${name}}} (open: ${closing ? closing.v : 'none'})`);
      }
    } else if (sigil === '&') {
      top.children.push({ t: 'raw', v: name });
    } else {
      top.children.push({ t: 'var', v: name });
    }
  }
  if (last < input.length) stack[stack.length - 1].children.push({ t: 'text', v: input.slice(last) });
  if (stack.length !== 1) throw new Error(`Template: unclosed section {{#${stack[stack.length - 1].v}}}`);
  return root;
}

function lookup(scopes, path) {
  if (path === '.') return scopes[scopes.length - 1];
  const parts = path.split('.');
  for (let i = scopes.length - 1; i >= 0; i--) {
    let cur = scopes[i];
    if (cur === null || typeof cur !== 'object') continue;
    let ok = true;
    for (const part of parts) {
      if (cur !== null && typeof cur === 'object' && part in cur) cur = cur[part];
      else { ok = false; break; }
    }
    if (ok) return cur;
  }
  return undefined;
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ESC[c]); }

function stringify(v) {
  if (v === undefined || v === null || v === false) return '';
  return String(v);
}

function isEmpty(v) {
  if (v === undefined || v === null || v === false || v === '') return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

function renderNodes(nodes, scopes, out) {
  for (const node of nodes) {
    if (node.t === 'text') { out.push(node.v); continue; }
    if (node.t === 'var') { out.push(escapeHtml(stringify(lookup(scopes, node.v)))); continue; }
    if (node.t === 'raw') { out.push(stringify(lookup(scopes, node.v))); continue; }
    const value = lookup(scopes, node.v);
    if (node.t === 'inverted') {
      if (isEmpty(value)) renderNodes(node.children, scopes, out);
      continue;
    }
    if (isEmpty(value)) continue;
    if (Array.isArray(value)) {
      value.forEach((item, i) => {
        const frame = (item !== null && typeof item === 'object') ? Object.create(item) : item;
        const meta = {
          '@index': i,
          '@n': String(i + 1).padStart(2, '0'),
          '@num': i + 1,
          '@count': value.length,
          '@first': i === 0,
          '@last': i === value.length - 1,
          '@odd': i % 2 === 1
        };
        renderNodes(node.children, scopes.concat([meta, frame]), out);
      });
    } else if (typeof value === 'object') {
      renderNodes(node.children, scopes.concat([value]), out);
    } else {
      renderNodes(node.children, scopes, out);
    }
  }
}

function render(template, context) {
  const out = [];
  renderNodes(parse(template).children, [context], out);
  return out.join('');
}

module.exports = { render, escapeHtml };
