export function ls(fs, args) {
  const path = args[0] || '.';
  const showAll = args.includes('-a');
  const longFormat = args.includes('-l');

  if (longFormat) {
    const entries = fs.listDetailed(path);
    
    if (entries.error) {
      return { output: `ls: cannot access '${path}': ${entries.error}`, error: true };
    }

    const lines = entries.map(entry => {
      const type = entry.isDir ? 'd' : '-';
      const perms = 'rwxr-xr-x';
      const name = entry.isDir ? `\x1b[34m${entry.name}\x1b[0m` : entry.name;
      return `${type}${perms}  1 cyber cyber    0 Nov 30 14:30 ${name}`;
    });

    return { output: lines.join('\n'), error: false };
  }

  const items = fs.list(path);
  
  if (items.error) {
    return { output: `ls: cannot access '${path}': ${items.error}`, error: true };
  }

  // Color directories blue
  const colored = items.map(item => {
    const fullPath = path === '.' ? item : `${path}/${item}`;
    return fs.isDirectory(fullPath) ? `\x1b[34m${item}\x1b[0m` : item;
  });

  return { output: colored.join('  '), error: false };
}
