/**
 * Filesystem Loader
 * Fetches the filesystem.json manifest and loads file contents from /public/terminalFS
 * Supports prefix-based hidden files (flint-*)
 */

import { isFlintFile } from './flintVisibility.js';

/**
 * Load all files from the terminalFS directory
 * @returns {Promise<Object>} Virtual filesystem tree
 */
export async function loadFilesystem() {
  // Fetch the filesystem manifest
  const response = await fetch('/terminalFS-manifest.json');
  const manifest = await response.json();

  console.log('Manifest loaded:', manifest);

  // Build the filesystem tree - root represents /
  const root = {
    type: 'dir',
    name: '/',
    path: '/',
    children: {}
  };

  // Process all files in manifest
  for (const file of manifest.files) {
    console.log('Loading file:', file.path);
    
    if (file.type === 'text') {
      // Fetch text content
      const content = await fetch(`/terminalFS/${file.path}`).then(r => r.text());
      console.log('Loaded text file:', file.path, 'length:', content.length);
      addFileToTree(root, file.path, content, 'text');
    } else if (file.type === 'image') {
      // Just store the URL
      const url = `/terminalFS/${file.path}`;
      console.log('Registered image:', file.path);
      addFileToTree(root, file.path, url, 'image');
    }
  }

  console.log('Final filesystem structure:', root);

  return root;
}

/**
 * Ensure a directory exists in the tree
 */
function ensureDirectory(root, path) {
  const parts = path.split('/').filter(p => p);
  let current = root;
  let currentPath = '';

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    
    if (!current.children[part]) {
      current.children[part] = {
        type: 'dir',
        name: part,
        path: currentPath,
        children: {}
      };
    }
    current = current.children[part];
  }
}

/**
 * Add a file to the virtual filesystem tree
 * @param {Object} root - Root of the filesystem tree
 * @param {string} fullPath - Full path from import.meta.glob
 * @param {string} content - File content or URL
 * @param {string} fileType - 'text' or 'image'
 */
function addFileToTree(root, relativePath, content, fileType) {
  // relativePath is already clean (from manifest)
  // Split path into parts
  const parts = relativePath.split('/');
  const fileName = parts.pop();

  // Check if this is a hidden file (starts with "flint-")
  const hiddenPrefix = isFlintFile(fileName);

  // Navigate/create directory structure
  let current = root;
  let currentPath = '';

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    
    if (!current.children[part]) {
      current.children[part] = {
        type: 'dir',
        name: part,
        path: currentPath,
        children: {}
      };
    }
    current = current.children[part];
  }

  // Add the file with prefix-based metadata
  const filePath = currentPath ? `${currentPath}/${fileName}` : fileName;
  current.children[fileName] = {
    type: 'file',
    name: fileName,              // Full filename including "flint-" prefix
    path: filePath,              // Full path
    content: fileType === 'text' ? content : null,
    url: fileType === 'image' ? content : null,
    fileType,
    hiddenPrefix: hiddenPrefix,  // true if filename starts with "flint-"
    visible: !hiddenPrefix       // Non-prefixed files always visible, prefixed files hidden by default
  };
}

/**
 * Pretty print the filesystem tree (for debugging)
 * @param {Object} node - Node to print
 * @param {string} indent - Indentation string
 */
export function printTree(node, indent = '') {
  if (node.type === 'file') {
    console.log(`${indent}📄 ${node.name}`);
  } else {
    console.log(`${indent}📁 ${node.name || '/'}`);
    for (const child of Object.values(node.children)) {
      printTree(child, indent + '  ');
    }
  }
}
