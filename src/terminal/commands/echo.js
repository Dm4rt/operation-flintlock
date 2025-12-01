export function echo(fs, args) {
  return { output: args.join(' '), error: false };
}
