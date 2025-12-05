/**
 * scan command - Scan current directory for suspicious files
 * Hidden command not shown in help
 */
export function scan(fs, args) {
  const currentDir = fs.getCurrentNode();
  
  if (!currentDir || currentDir.type !== 'dir') {
    return { output: 'scan: current directory invalid', error: true };
  }

  const suspiciousFiles = [];
  const children = currentDir.children || {};
  
  for (const [name, node] of Object.entries(children)) {
    if (node.type === 'file') {
      // Flag hidden files or files with suspicious patterns
      const isSuspicious = 
        name.startsWith('.') || 
        name.includes('sys') || 
        name.includes('kernel') ||
        name.includes('tmp') ||
        name.includes('cache') ||
        name.endsWith('.log') ||
        name.endsWith('.bak') ||
        name.endsWith('.tmp') ||
        name.endsWith('.dat');
      
      if (isSuspicious) {
        suspiciousFiles.push(name);
      }
    }
  }

  if (suspiciousFiles.length === 0) {
    return { 
      output: '🔍 Scan complete. No suspicious files detected in current directory.', 
      error: false 
    };
  }

  const output = [
    '⚠️  SUSPICIOUS FILES DETECTED:',
    ...suspiciousFiles.map(f => `  - ${f}`),
    '',
    'Use "cat <filename>" to inspect or "rm <filename>" to remove.'
  ].join('\n');

  return { output, error: false };
}
