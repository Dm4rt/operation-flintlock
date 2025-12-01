export function help(fs, args) {
  const helpText = `Available commands:
  ls [-l] [path]     - List directory contents
  cd [path]          - Change directory
  pwd                - Print working directory
  cat <file>         - Display file contents
  echo <text>        - Display text
  clear              - Clear terminal
  help               - Show this help message
  whoami             - Display current user
  uname              - Display system information
  
Navigation:
  ~                  - Home directory
  .                  - Current directory
  ..                 - Parent directory
  /                  - Root directory`;

  return { output: helpText, error: false };
}
