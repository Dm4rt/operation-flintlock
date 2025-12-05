/**
 * Command Parser
 * Parses command strings and dispatches to appropriate handlers
 */

import * as commands from './commands';

export class CommandParser {
  constructor(fs, socket) {
    this.fs = fs;
    this.socket = socket;
  }

  /**
   * Parse and execute a command
   */
  execute(input) {
    const trimmed = input.trim();
    
    if (!trimmed) {
      return { output: '', error: false };
    }

    // Split command and arguments (simple parsing, no quote handling for now)
    const parts = trimmed.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    // Check if command exists
    if (!commands[command]) {
      return {
        output: `bash: ${command}: command not found`,
        error: true
      };
    }

    // Execute command
    try {
      return commands[command](this.fs, args, this.socket);
    } catch (error) {
      return {
        output: `Error executing ${command}: ${error.message}`,
        error: true
      };
    }
  }
}
