/**
 * Virtual Filesystem Engine
 * Manages a JSON-based filesystem structure in memory
 * Extended to support real filesystem data and visibility filtering
 */

import { isVisible, filterVisibleChildren } from './visibility.js';

export class VirtualFS {
  constructor(fsData, useRealFS = false) {
    // Support both old JSON format and new real filesystem format
    if (useRealFS) {
      // fsData is the root node from fsLoader
      this.root = fsData;
      this.useRealFS = true;
      this.currentPath = '/';  // Start at root for real filesystem
    } else {
      // Legacy JSON format
      this.root = fsData['/'];
      this.useRealFS = false;
      this.currentPath = '/home/cyber';
    }
  }

  /**
   * Normalize a path (resolve . and ..)
   */
  normalizePath(path) {
    if (path === '~') {
      return this.useRealFS ? '/' : '/home/cyber';
    }
    
    let absolute;
    if (path.startsWith('/')) {
      absolute = path;
    } else {
      absolute = this.currentPath === '/' 
        ? `/${path}` 
        : `${this.currentPath}/${path}`;
    }

    const parts = absolute.split('/').filter(p => p !== '');
    const normalized = [];

    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') {
        normalized.pop();
      } else {
        normalized.push(part);
      }
    }

    return '/' + normalized.join('/');
  }

  /**
   * Get a node (file or directory) at the given path
   * Respects visibility rules when using real filesystem
   */
  getNode(path, checkVisibility = true) {
    const normalized = this.normalizePath(path);
    
    // Check visibility for real filesystem
    if (this.useRealFS && checkVisibility) {
      const relativePath = normalized.replace(/^\//, '');
      if (relativePath && !isVisible(relativePath)) {
        return null;
      }
    }
    
    if (normalized === '/') {
      return this.root;
    }

    const parts = normalized.split('/').filter(p => p !== '');
    let current = this.root;

    for (const part of parts) {
      if (!current || current.type !== 'dir' || !current.children || !current.children[part]) {
        return null;
      }
      current = current.children[part];
    }

    return current;
  }

  /**
   * Check if a path exists
   */
  exists(path) {
    return this.getNode(path) !== null;
  }

  /**
   * Check if a path is a directory
   */
  isDirectory(path) {
    const node = this.getNode(path);
    return node !== null && node.type === 'dir';
  }

  /**
   * Check if a path is a file
   */
  isFile(path) {
    const node = this.getNode(path);
    return node !== null && node.type === 'file';
  }

  /**
   * List contents of a directory
   * Filters results based on visibility when using real filesystem
   */
  list(path = '.') {
    const node = this.getNode(path);
    
    if (!node) {
      return { error: 'No such file or directory' };
    }

    if (node.type !== 'dir') {
      return { error: 'Not a directory' };
    }

    const children = node.children || {};
    
    // Filter by visibility for real filesystem
    if (this.useRealFS) {
      const normalizedPath = this.normalizePath(path).replace(/^\//, '');
      const visibleChildren = filterVisibleChildren(children, normalizedPath);
      return Object.keys(visibleChildren);
    }

    return Object.keys(children);
  }

  /**
   * Read file content
   * Supports both text content and image URLs for real filesystem
   */
  readFile(path) {
    const node = this.getNode(path);
    
    if (!node) {
      return { error: 'No such file or directory' };
    }

    if (node.type !== 'file') {
      return { error: 'Is a directory' };
    }

    // Support real filesystem with images
    if (this.useRealFS) {
      if (node.fileType === 'image') {
        return { 
          content: `[IMAGE] ${node.name}\nURL: ${node.url}`,
          url: node.url,
          isImage: true
        };
      }
      return { content: node.content || '' };
    }

    return { content: node.content || '', remote: node.remote };
  }

  /**
   * Change current directory
   */
  changeDirectory(path) {
    const targetPath = this.normalizePath(path);
    const node = this.getNode(targetPath);

    if (!node) {
      return { error: 'No such file or directory', path: this.currentPath };
    }

    if (node.type !== 'dir') {
      return { error: 'Not a directory', path: this.currentPath };
    }

    this.currentPath = targetPath === '' ? '/' : targetPath;
    return { path: this.currentPath };
  }

  /**
   * Get current working directory
   */
  pwd() {
    return this.currentPath;
  }

  /**
   * Get detailed info about directory contents
   * Filters results based on visibility when using real filesystem
   */
  listDetailed(path = '.') {
    const node = this.getNode(path);
    
    if (!node) {
      return { error: 'No such file or directory' };
    }

    if (node.type !== 'dir') {
      return { error: 'Not a directory' };
    }

    const entries = [];
    let children = node.children || {};

    // Filter by visibility for real filesystem
    if (this.useRealFS) {
      const normalizedPath = this.normalizePath(path).replace(/^\//, '');
      children = filterVisibleChildren(children, normalizedPath);
    }

    for (const [name, child] of Object.entries(children)) {
      entries.push({
        name,
        type: child.type,
        isDir: child.type === 'dir',
        fileType: child.fileType || null
      });
    }

    return entries;
  }
}
