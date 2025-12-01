export function cat(fs, args) {
  if (args.length === 0) {
    return { output: 'cat: missing file operand', error: true };
  }

  const results = [];
  
  for (const path of args) {
    const result = fs.readFile(path);
    
    if (result.error) {
      results.push(`cat: ${path}: ${result.error}`);
    } else {
      // Handle image files differently
      if (result.isImage) {
        results.push(`[IMAGE: ${path}]`);
        results.push(`URL: ${result.url}`);
        results.push(`\nNote: Images cannot be displayed in terminal. Use a browser to view.`);
      } else {
        results.push(result.content);
      }
    }
  }

  return { output: results.join('\n'), error: false };
}
