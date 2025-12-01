export function uname(fs, args) {
  if (args.includes('-a')) {
    return { 
      output: 'Linux flintlock 5.15.0-flintlock #1 SMP x86_64 GNU/Linux', 
      error: false 
    };
  }
  return { output: 'Linux', error: false };
}
