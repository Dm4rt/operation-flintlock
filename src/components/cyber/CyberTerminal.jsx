import React, { useState, useEffect, useRef } from 'react';
import StarBackground from '../StarBackground';
import { VirtualFS } from '../../terminal/fs';
import { CommandParser } from '../../terminal/parser';
import { loadFilesystem } from '../../terminal/fsLoader';
import { useFlintlockSocket } from '../../hooks/useFlintlockSocket';
import { db } from '../../services/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';

export default function CyberTerminal({ operationId, sessionId }) {
  const socket = useFlintlockSocket(sessionId, 'cyber', 'Cyber');
  const [lines, setLines] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [fs, setFs] = useState(null);
  const [parser, setParser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeViruses, setActiveViruses] = useState([]);
  
  const terminalRef = useRef(null);
  const inputRef = useRef(null);
  const fsRootRef = useRef(null);
  const isInitialized = useRef(false);

  // Load filesystem from real files (ONLY ONCE)
  useEffect(() => {
    if (isInitialized.current) return; // Prevent re-initialization
    isInitialized.current = true;

    const initFilesystem = async () => {
      try {
        // Load real filesystem
        const fsRoot = await loadFilesystem();
        fsRootRef.current = fsRoot;
        
        console.log('Loaded filesystem root:', fsRoot);
        console.log('Root children:', Object.keys(fsRoot.children));
        
        // Create VirtualFS without socket initially (will be set later)
        const filesystem = new VirtualFS(fsRoot, true, {}, null, operationId);
        const cmdParser = new CommandParser(filesystem, null);
        
        setFs(filesystem);
        setParser(cmdParser);
        
        // Initial terminal output
        setLines([
          { type: 'system', text: 'FLINTLOCK CYBER OPERATIONS TERMINAL v3.0.0' },
          { type: 'system', text: 'Real Filesystem Mode Enabled' },
          { type: 'system', text: 'Establishing secure connection...' },
          { type: 'success', text: '✓ Connected to Operation ' + operationId },
          { type: 'system', text: '' },
          { type: 'system', text: 'Type "help" for available commands.' },
          { type: 'system', text: '' }
        ]);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load filesystem:', err);
        setLines([
          { type: 'error', text: 'Failed to load filesystem. Please refresh.' }
        ]);
        setIsLoading(false);
      }
    };

    initFilesystem();
  }, []);

  // Update filesystem socket reference when socket connects
  useEffect(() => {
    if (fs && socket.isConnected) {
      fs.socket = socket;
      console.log('[Cyber] Socket attached to filesystem');
      // Update parser with socket
      setParser(new CommandParser(fs, socket));
    }
  }, [fs, socket.isConnected]);

  // Subscribe to Socket.IO visibility changes for .flint files
  useEffect(() => {
    if (!fs || !socket.isConnected) return;

    console.log('[Cyber] Subscribing to flint visibility via Socket.IO');

    const unsubscribe = socket.on('flint:visibility', ({ filename, visible }) => {
      console.log('[Cyber] File visibility update:', filename, visible);
      
      // Update the filesystem with new visibility
      fs.updateVisibility({ [filename]: visible });
      
      // Show notification for newly revealed files
      if (visible) {
        setLines(prev => [
          ...prev,
          { type: 'system', text: '' },
          { type: 'success', text: '✓ File access granted: ' + filename },
          { type: 'system', text: '' }
        ]);
      }
      
      // Force re-render by updating parser
      setParser(new CommandParser(fs, socket));
    });

    return unsubscribe;
  }, [fs, socket]);

  // Subscribe to virus injects via Firestore
  const processedVirusesRef = useRef(new Set());
  
  useEffect(() => {
    if (!fs || !sessionId || !db) return;

    const unsubscribe = onSnapshot(
      query(collection(db, 'sessions', sessionId, 'injects'), where('team', '==', 'cyber')),
      (snapshot) => {
        const activeVirusList = [];
        
        snapshot.forEach((docSnap) => {
          const inject = docSnap.data();
          
          if (inject.type === 'virus-detected' && inject.status === 'active' && inject.payload) {
            const payload = { ...inject.payload, injectDocId: docSnap.id };

            // Check if this virus was already processed (avoid re-adding files/messages)
            if (!processedVirusesRef.current.has(payload.id)) {
              console.log('[Cyber] Virus inject activated:', inject);
              processedVirusesRef.current.add(payload.id);
              
              // Add virus file to filesystem
              const result = fs.addFile(payload.virusPath, `[INFECTED - ${payload.virusType.toUpperCase()}]`);
              if (result.success) {
                console.log('[Cyber] Virus file added:', payload.virusPath);
              }

              // Add gibberish files for trojan
              if (payload.virusType === 'trojan' && payload.gibberishFiles) {
                payload.gibberishFiles.forEach(gibPath => {
                  const gibberish = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                  fs.addFile(gibPath, gibberish);
                });
              }

              // Show warning message
              const warningMessages = {
                visual: '⚠️ CRITICAL: System integrity compromised! Unknown process detected.',
                keylogger: '⚠️ WARNING: Input anomaly detected. Keyboard buffer may be corrupted.',
                trojan: '⚠️ ALERT: Unauthorized file creation detected.'
              };

              setLines(prev => [
                ...prev,
                { type: 'system', text: '' },
                { type: 'error', text: warningMessages[payload.virusType] },
                { type: 'error', text: 'Run diagnostics immediately.' },
                { type: 'system', text: '' }
              ]);
            }

            activeVirusList.push(payload);
          }
        });
        
        setActiveViruses(activeVirusList);
      }
    );

    return unsubscribe;
  }, [fs, sessionId, db]);

  // Listen for file deletions to resolve virus injects
  useEffect(() => {
    if (!socket.isConnected || !sessionId || !db) return;

    const handleFileDeletion = async ({ filename, path }) => {
      console.log('[Cyber] File deleted:', path);
      
      // Check if deleted file matches any active virus
      const matchingVirus = activeViruses.find(v => v.virusPath === path);
      if (matchingVirus && matchingVirus.injectDocId) {
        console.log('[Cyber] ✅ Virus eliminated! Resolving inject...');
        
        const injectRef = doc(db, 'sessions', sessionId, 'injects', matchingVirus.injectDocId);
        await updateDoc(injectRef, {
          status: 'resolved',
          resolvedAt: new Date().toISOString()
        }).catch(err => console.error('[Cyber] Failed to resolve virus:', err));
        
        setLines(prev => [
          ...prev,
          { type: 'system', text: '' },
          { type: 'success', text: '✓ Threat neutralized. System integrity restored.' },
          { type: 'system', text: '' }
        ]);
      }
    };

    const unsubscribe = socket.on('cyber:file-deleted', handleFileDeletion);
    return unsubscribe;
  }, [socket, activeViruses, sessionId, db]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  // Focus input on mount
  useEffect(() => {
    if (!isLoading) {
      inputRef.current?.focus();
    }
  }, [isLoading]);

  const getPrompt = () => {
    if (!fs) return 'cyber@flintlock:~$';
    const cwd = fs.pwd();
    const dir = cwd === '/' ? '~' : (cwd === '/home/cyber' ? '~' : cwd);
    return `cyber@flintlock:${dir}$`;
  };

  const handleCommand = (cmd) => {
    const trimmed = cmd.trim();
    
    if (!parser || !fs) return;

    // Add command to history
    if (trimmed) {
      setCommandHistory(prev => [...prev, trimmed]);
      setHistoryIndex(-1);
    }

    // Add command line to output
    setLines(prev => [...prev, { 
      type: 'input', 
      text: `${getPrompt()} ${trimmed}` 
    }]);

    if (!trimmed) {
      setCurrentInput('');
      return;
    }

    // Execute command
    const result = parser.execute(trimmed);

    // Handle clear command
    if (result.clear) {
      setLines([]);
      setCurrentInput('');
      return;
    }

    // Add output
    if (result.output) {
      const outputLines = result.output.split('\n').map(line => ({
        type: result.error ? 'error' : 'output',
        text: line
      }));
      setLines(prev => [...prev, ...outputLines]);
    }

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
    } else {
      // Apply ASCII shift for keylogger virus
      const keyloggerVirus = activeViruses.find(v => v.virusType === 'keylogger');
      if (keyloggerVirus && e.key.length === 1) {
        e.preventDefault();
        const shifted = String.fromCharCode(e.key.charCodeAt(0) + keyloggerVirus.asciiShift);
        setCurrentInput(prev => prev + shifted);
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
        return '';
      case 'prompt':
        return 'text-emerald-400 font-semibold';
      default:
        return 'text-slate-300';
    }
  };

  // Render input line with green prompt and white command
  const renderInputLine = (text) => {
    const promptMatch = text.match(/^(cyber@flintlock:[^$]*\$)\s*(.*)$/);
    if (promptMatch) {
      return (
        <>
          <span className="text-emerald-400 font-semibold">{promptMatch[1]}</span>
          <span className="text-white"> {promptMatch[2]}</span>
        </>
      );
    }
    return text;
  };

  // Helper to render text with ANSI color codes
  const renderLineWithColors = (text) => {
    if (!text.includes('\x1b[')) return text;

    const parts = [];
    let currentIndex = 0;
    const ansiRegex = /\x1b\[(\d+)m/g;
    let match;
    let currentColor = 'text-slate-300';

    const colorMap = {
      '0': 'text-slate-300',   // reset
      '34': 'text-blue-400',    // blue (directories)
      '32': 'text-emerald-400', // green
      '33': 'text-yellow-400',  // yellow
      '31': 'text-red-400',     // red
    };

    while ((match = ansiRegex.exec(text)) !== null) {
      // Add text before the color code
      if (match.index > currentIndex) {
        const textPart = text.substring(currentIndex, match.index);
        parts.push(
          <span key={currentIndex} className={currentColor}>
            {textPart}
          </span>
        );
      }

      // Update color
      currentColor = colorMap[match[1]] || currentColor;
      currentIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(
        <span key={currentIndex} className={currentColor}>
          {text.substring(currentIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : text;
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
              <h1 className="text-xl font-bold text-slate-100">Cyber Console</h1>
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
          <div className={`h-full bg-black/90 rounded-xl border shadow-2xl overflow-hidden ${
            activeViruses.some(v => v.virusType === 'visual') 
              ? 'border-red-500 shadow-red-500/50 animate-pulse' 
              : 'border-slate-800'
          }`}>
            <div
              ref={terminalRef}
              className={`h-full overflow-y-auto p-6 font-mono text-sm ${
                activeViruses.some(v => v.virusType === 'visual') ? 'text-red-400' : ''
              }`}
              onClick={() => inputRef.current?.focus()}
            >
              {!fs && (
                <div className="text-yellow-400">Loading filesystem...</div>
              )}
              {lines.map((line, idx) => (
                <div key={idx} className={getLineClass(line.type)}>
                  {line.type === 'input' ? renderInputLine(line.text) : renderLineWithColors(line.text)}
                </div>
              ))}
              {fs && (
                <div className="flex items-center">
                  <span className="text-emerald-400 font-semibold">{getPrompt()}</span>
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
                  <span className="text-white animate-pulse">▊</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
