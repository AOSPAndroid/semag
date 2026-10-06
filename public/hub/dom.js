// Keep unchanged HUD values out of the DOM. Replacing text nodes and setting
// identical attributes still creates mutation work for the browser.
export function setText(node, value) {
  const text = String(value ?? '');
  if (node.textContent !== text) node.textContent = text;
}

export function setAttribute(node, name, value) {
  const text = String(value);
  if (node.getAttribute(name) !== text) node.setAttribute(name, text);
}

export function setHidden(node, value) {
  if (node.hidden !== !!value) node.hidden = !!value;
}

export function setDisabled(node, value) {
  if (node.disabled !== !!value) node.disabled = !!value;
}

export function setClass(node, value) {
  if (node.className !== value) node.className = value;
}

export function toggleClass(node, name, value) {
  if (node.classList.contains(name) !== !!value) node.classList.toggle(name, !!value);
}

export function setStyle(node, name, value) {
  if (node.style[name] !== value) node.style[name] = value;
}

const htmlValues = new WeakMap();
export function setHTML(node, value) {
  if (htmlValues.get(node) === value) return;
  node.innerHTML = value;
  htmlValues.set(node, value);
}
