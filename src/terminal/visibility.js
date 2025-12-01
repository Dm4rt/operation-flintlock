/**
 * Visibility System
 * Controls which files and directories are visible in the terminal
 */

import visibilityRules from './visibility.json';

/**
 * Check if a path is visible according to visibility rules
 * @param {string} path - Path to check (relative to filesystem root)
 * @returns {boolean} True if visible, false otherwise
 */
export function isVisible(path) {
  // Remove leading/trailing slashes for consistency
  const normalizedPath = path.replace(/^\/+|\/+$/g, '');
  
  // Empty path (root) is always visible
  if (!normalizedPath) return true;

  // Check if path has explicit rule
  if (normalizedPath in visibilityRules) {
    return visibilityRules[normalizedPath];
  }

  // Check parent directories - if any parent is hidden, child is hidden
  const parts = normalizedPath.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const parentPath = parts.slice(0, i).join('/');
    if (parentPath in visibilityRules && !visibilityRules[parentPath]) {
      return false;
    }
  }

  // Default: visible if no rule explicitly hides it
  return true;
}

/**
 * Filter a list of paths to only include visible ones
 * @param {string[]} paths - Array of paths to filter
 * @returns {string[]} Filtered array of visible paths
 */
export function filterVisible(paths) {
  return paths.filter(isVisible);
}

/**
 * Filter filesystem children to only include visible ones
 * @param {Object} children - Children object from filesystem node
 * @param {string} parentPath - Parent directory path
 * @returns {Object} Filtered children object
 */
export function filterVisibleChildren(children, parentPath = '') {
  const filtered = {};
  
  for (const [name, node] of Object.entries(children)) {
    const nodePath = parentPath ? `${parentPath}/${name}` : name;
    
    if (isVisible(nodePath)) {
      filtered[name] = node;
    }
  }
  
  return filtered;
}

/**
 * Check if a directory contains any visible children (recursive)
 * @param {Object} node - Directory node to check
 * @param {string} path - Path to the directory
 * @returns {boolean} True if directory has visible children
 */
export function hasVisibleChildren(node, path = '') {
  if (node.type !== 'dir') return false;

  for (const [name, child] of Object.entries(node.children)) {
    const childPath = path ? `${path}/${name}` : name;
    
    if (isVisible(childPath)) {
      return true;
    }
    
    // Recursively check subdirectories
    if (child.type === 'dir' && hasVisibleChildren(child, childPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Get visibility rules (for debugging/admin)
 * @returns {Object} Current visibility rules
 */
export function getVisibilityRules() {
  return { ...visibilityRules };
}
