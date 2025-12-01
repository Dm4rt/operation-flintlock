export function cd(fs, args) {
  const path = args[0] || '~';
  const result = fs.changeDirectory(path);

  if (result.error) {
    return { output: `cd: ${result.error}: ${path}`, error: true };
  }

  return { output: '', error: false };
}
