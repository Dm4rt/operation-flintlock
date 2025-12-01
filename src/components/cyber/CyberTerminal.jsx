import React, { useState, useEffect, useRef } from 'react';
import StarBackground from '../StarBackground';

export default function CyberTerminal({ operationId }) {
  const [lines, setLines] = useState([
    { type: 'system', text: 'FLINTLOCK CYBER OPERATIONS TERMINAL v2.4.1' },
    { type: 'system', text: 'Establishing secure connection...' },
    { type: 'success', text: '✓ Connected to Operation ' + operationId },
    { type: 'system', text: '' },
    { type: 'prompt', text: 'cyber@flintlock:~$' }
  ]);
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom when new lines added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCommand = (cmd) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    // Add command to history
    setCommandHistory(prev => [...prev, trimmed]);
    setHistoryIndex(-1);

    // Add command line to output
    setLines(prev => [...prev, { type: 'input', text: `cyber@flintlock:~$ ${trimmed}` }]);

    // Process command
    const [command, ...args] = trimmed.toLowerCase().split(' ');

    let response = [];

    switch (command) {
      case 'help':
        response = [
          { type: 'info', text: 'Available commands:' },
          { type: 'info', text: '  help       - Show this help message' },
          { type: 'info', text: '  status     - Show system status' },
          { type: 'info', text: '  scan       - Scan for network targets' },
          { type: 'info', text: '  clear      - Clear terminal' },
          { type: 'info', text: '  whoami     - Display current user' },
          { type: 'info', text: '  ls         - List directory contents' },
          { type: 'info', text: '  pwd        - Print working directory' }
        ];
        break;

      case 'status':
        response = [
          { type: 'success', text: '✓ Operation Status: ACTIVE' },
          { type: 'info', text: '  Network: ONLINE' },
          { type: 'info', text: '  Encryption: AES-256' },
          { type: 'info', text: '  Clearance: TOP SECRET' }
        ];
        break;

      case 'scan':
        response = [
          { type: 'system', text: 'Initiating network scan...' },
          { type: 'info', text: '[████████████████████████████████] 100%' },
          { type: 'success', text: 'Scan complete. 3 targets identified.' }
        ];
        break;

      case 'whoami':
        response = [{ type: 'info', text: 'cyber' }];
        break;

      case 'pwd':
        response = [{ type: 'info', text: '/home/cyber' }];
        break;

      case 'ls':
        response = [
          { type: 'info', text: 'missions/  logs/  tools/  README.txt' }
        ];
        break;

      case 'clear':
        setLines([{ type: 'prompt', text: 'cyber@flintlock:~$' }]);
        setCurrentInput('');
        return;

      default:
        response = [{ type: 'error', text: `Command not found: ${command}. Type 'help' for available commands.` }];
    }

    // Add response and new prompt
    setLines(prev => [
      ...prev,
      ...response,
      { type: 'system', text: '' },
      { type: 'prompt', text: 'cyber@flintlock:~$' }
    ]);

    setCurrentInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommand(currentInput);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = Math.min(commandHistory.length - 1, historyIndex + 1);
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[newIndex]);
      } else {
        setCurrentInput('');
      }
    }
  };

  const getLineClass = (type) => {
    switch (type) {
      case 'system':
        return 'text-slate-400';
      case 'success':
        return 'text-emerald-400';
      case 'error':
        return 'text-red-400';
      case 'info':
        return 'text-blue-300';
      case 'input':
        return 'text-white';
      case 'prompt':
        return 'text-emerald-400 font-semibold';
      default:
        return 'text-slate-300';
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-white flex flex-col">
      <StarBackground />

      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="bg-[#0a0f1e] border-b border-slate-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="px-3 py-1.5 rounded border border-purple-500 bg-purple-500/10">
                <span className="text-sm font-bold text-purple-200">CYBER</span>
              </div>
              <h1 className="text-xl font-bold text-slate-100">Space Ops Console</h1>
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">Cyber Operations Terminal</p>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <p className="text-[11px] uppercase text-slate-500">Operation ID</p>
                <p className="text-lg font-mono text-slate-200">{operationId}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Terminal */}
        <div className="flex-1 p-6 overflow-hidden">
          <div className="h-full bg-black/90 rounded-xl border border-slate-800 shadow-2xl overflow-hidden">
            <div
              ref={terminalRef}
              className="h-full overflow-y-auto p-6 font-mono text-sm"
              onClick={() => inputRef.current?.focus()}
            >
              {lines.map((line, idx) => (
                <div key={idx} className={getLineClass(line.type)}>
                  {line.text}
                </div>
              ))}
              <div className="flex items-center text-white">
                <span className="text-emerald-400 font-semibold">cyber@flintlock:~$</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-none outline-none ml-2 text-white font-mono"
                  spellCheck={false}
                  autoComplete="off"
                />
                <span className="animate-pulse">▊</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
