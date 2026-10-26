// Création d’éléments HTML en une ligne.

/**
 * @param {string} tag
 * @param {{ className?: string, text?: string, attrs?: Record<string, string> }} [options]
 * @param {Array<Node | string>} [children]
 * @returns {HTMLElement}
 */
export function el(tag, { className, text, attrs } = {}, children = []) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  for (const [name, value] of Object.entries(attrs || {})) element.setAttribute(name, value);
  element.append(...children);
  return element;
}
