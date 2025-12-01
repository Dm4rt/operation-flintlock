/**
 * Virtual Filesystem Engine
 * Manages a JSON-based filesystem structure in memory
 * Extended to support real filesystem data and .flint hidden files
 */

export class VirtualFS {
  constructor(fsData, useRealFS = false, visibilityMap = {}) {
    // Support both old JSON format and new real filesystem format
    if (useRealFS) {
      // fsData is the root node from fsLoader
      this.root = fsData;
      this.useRealFS = true;
      this.currentPath = '/';  // Start at root for real filesystem
      this.visibilityMap = visibilityMap;
      
      // Apply visibility map to .flint files
      this.applyVisibilityMap(this.root);
    } else {
      // Legacy JSON format
      this.root = fsData['/'];
      this.useRealFS = false;
      this.currentPath = '/home/cyber';
      this.visibilityMap = {};
    }
  }

  /**
   * Apply Firestore visibility map to flint- prefixed files in the tree
   */
  applyVisibilityMap(node, parentPath = '') {
    if (node.type === 'dir' && node.children) {
      for (const [childName, childNode] of Object.entries(node.children)) {
        this.applyVisibilityMap(childNode, node.path || parentPath);
      }
    } else if (node.type === 'file' && node.hiddenPrefix) {
      // Update visibility for flint- prefixed files based on Firestore
      // Use filename (not full path) as the key
      const wasVisible = node.visible;
      node.visible = this.visibilityMap[node.name] === true;
      
      if (wasVisible !== node.visible) {
        console.log(`[FS] File visibility changed: ${node.name} = ${node.visible} (path: ${node.path})`);
      }
    }
  }

  /**
   * Update visibility map (called when Firestore changes)
   */
  updateVisibility(newVisibilityMap) {
    console.log('[FS] Updating visibility map:', newVisibilityMap);
    this.visibilityMap = newVisibilityMap;
    this.applyVisibilityMap(this.root);
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
   * Respects flint- prefix visibility
   */
  getNode(path, checkVisibility = true) {
    const normalized = this.normalizePath(path);
    
    if (normalized === '/') {
      return this.root;
    }

    const parts = normalized.split('/').filter(p => p !== '');
    let current = this.root;

    for (const part of parts) {
      if (!current || current.type !== 'dir' || !current.children) {
        return null;
      }

      const child = current.children[part];

      if (!child) {
        return null;
      }

      // Check visibility for flint- prefixed files
      if (checkVisibility && child.hiddenPrefix && !child.visible) {
        return null;
      }

      current = child;
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
   * Only shows visible files (non-prefixed or visible flint- files)
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
    const names = [];

    for (const [childName, childNode] of Object.entries(children)) {
      // Skip hidden flint- prefixed files
      if (childNode.hiddenPrefix && !childNode.visible) {
        continue;
      }
      
      // Use full filename including "flint-" prefix when visible
      names.push(childNode.name);
    }

    return names;
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
   * Only includes visible files
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
    const children = node.children || {};

    for (const [childName, child] of Object.entries(children)) {
      // Skip hidden flint- prefixed files
      if (child.hiddenPrefix && !child.visible) {
        continue;
      }

      entries.push({
        name: child.name,  // Use full filename including prefix
        type: child.type,
        isDir: child.type === 'dir',
        fileType: child.fileType || null
      });
    }

    return entries;
  }
}
