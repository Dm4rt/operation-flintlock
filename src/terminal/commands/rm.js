/**
 * rm command - Remove files
 */
export function rm(fs, args) {
  if (args.length === 0) {
    return { output: 'rm: missing operand\nUsage: rm <file>', error: true };
  }

  const filename = args[0];
  const result = fs.deleteFile(filename);

  if (result.success) {
    // Store deleted file info for virus resolution check
    if (fs.socket) {
      fs.socket.emit('cyber:file-deleted', { filename, path: result.path });
    }
    return { output: '', error: false };
  } else {
    return { output: `rm: cannot remove '${filename}': ${result.error}`, error: true };
  }
}
