import React, { useState, useEffect } from 'react';
import { LogIn, Command, Cpu, Compass, Radar, Zap } from 'lucide-react';

// --- Constants & Data ---

const ROLES = {
    WELCOME: 'welcome',
    JOIN_SCENARIO: 'join_scenario',
    ADMIN: 'admin',
    MISSION_CMD: 'mission_cmd',
    INTEL: 'intel',
    CYBER: 'cyber',
    SDA: 'sda',
    EW: 'ew',
};

// Team definitions with distinct colors for visual flair
const teams = [
    { 
        id: ROLES.MISSION_CMD, 
        name: 'Mission Command', 
        icon: Command, 
        description: 'Central Coordination (USSPACECOM)',
        color: 'text-red-500',
        borderColor: 'border-red-500',
        bgColor: 'hover:bg-red-950/30',
        shadowColor: 'shadow-red-500/20'
    },
    { 
        id: ROLES.INTEL, 
        name: 'Intel', 
        icon: Compass, 
        description: 'Threat and Target Analysis',
        color: 'text-blue-500',
        borderColor: 'border-blue-500',
        bgColor: 'hover:bg-blue-950/30',
        shadowColor: 'shadow-blue-500/20'
    },
    { 
        id: ROLES.CYBER, 
        name: 'Cyber', 
        icon: Cpu, 
        description: 'Cyber Defense and Offense',
        color: 'text-purple-500',
        borderColor: 'border-purple-500',
        bgColor: 'hover:bg-purple-950/30',
        shadowColor: 'shadow-purple-500/20'
    },
    { 
        id: ROLES.SDA, 
        name: 'Space Ops - SDA', 
        icon: Radar, 
        description: 'Space Domain Awareness',
        color: 'text-orange-500',
        borderColor: 'border-orange-500',
        bgColor: 'hover:bg-orange-950/30',
        shadowColor: 'shadow-orange-500/20'
    },
    { 
        id: ROLES.EW, 
        name: 'Space Ops - EW', 
        icon: Zap, 
        description: 'Electronic Warfare Operations',
        color: 'text-yellow-500',
        borderColor: 'border-yellow-500',
        bgColor: 'hover:bg-yellow-950/30',
        shadowColor: 'shadow-yellow-500/20'
    },
];

// --- Background Component ---

const StarBackground = () => {
    // Generate static random positions so they don't re-render constantly
    // In a real app, useMemo would be good here, but for simplicity we just define them once.
    const [stars, setStars] = useState([]);

    useEffect(() => {
        const starCount = 75;
        const newStars = [];
        for (let i = 0; i < starCount; i++) {
            newStars.push({
                id: i,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                size: `${Math.random() * 2 + 1}px`,
                duration: `${Math.random() * 10 + 20}s`, // Slow movement between 20s and 30s
                delay: `${Math.random() * 5}s`,
                opacity: Math.random() * 0.7 + 0.3,
            });
        }
        setStars(newStars);
    }, []);

    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <style>
                {`
                @keyframes floatUp {
                    0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(-10vh) rotate(360deg); opacity: 0; }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; }
                }
                `}
            </style>
            {/* Deep Space Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#050b14] to-slate-950" />
            
            {/* Stars */}
            {stars.map((star) => (
                <div
                    key={star.id}
                    className="absolute bg-white rounded-full"
                    style={{
                        left: star.left,
                        width: star.size,
                        height: star.size,
                        opacity: star.opacity,
                        animation: `floatUp ${star.duration} linear infinite, pulse 3s ease-in-out infinite`,
                        animationDelay: `-${Math.random() * 20}s`, // Start at random times in the cycle
                        top: star.top, // Initial position (overridden by animation for moving ones, but good for static fallback)
                    }}
                />
            ))}
            
            {/* Overlay grid for "tactical" feel */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay"></div>
        </div>
    );
};

// --- Main Component ---

export default function App() {
    const [userRole, setUserRole] = useState(ROLES.WELCOME);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [scenarioCode, setScenarioCode] = useState('');

    const handleTeamSelect = (role) => {
        setSelectedTeam(role);
        if (role === ROLES.ADMIN) {
            setUserRole(ROLES.ADMIN);
        } else {
            setUserRole(ROLES.JOIN_SCENARIO);
        }
    };

    const handleScenarioJoin = () => {
        if (scenarioCode.trim() && selectedTeam) {
            console.log(`Joining Scenario ${scenarioCode} as ${selectedTeam}...`);
            setUserRole(selectedTeam);
        }
    };

    // --- Render Helpers ---

    const renderWelcomeScreen = () => (
        <div className="flex flex-col items-center space-y-12 py-12 px-4 max-w-7xl mx-auto w-full animate-fade-in relative z-10">
            <div className="text-center space-y-6">
                <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-white to-blue-400 tracking-tight drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                    OPERATION <span className="text-blue-500">FLINTLOCK</span>
                </h1>
                <p className="text-2xl text-slate-400 font-light tracking-wide">
                    SECURE TERMINAL ACCESS
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                {/* Admin Card */}
                <div 
                    onClick={() => handleTeamSelect(ROLES.ADMIN)}
                    className="group flex flex-col items-center justify-center p-8 bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-lg border border-slate-700 hover:border-slate-400 transition-all duration-300 cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-500/10"
                >
                    <div className="p-4 bg-slate-800 rounded-full shadow-inner mb-4 group-hover:scale-110 transition-transform group-hover:bg-slate-700">
                        <LogIn className="w-8 h-8 text-slate-200" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-100">Admin Panel</h2>
                    <p className="text-sm text-slate-400 text-center mt-2">Generate & Control Scenarios</p>
                </div>
                
                {/* Team Cards */}
                {teams.map((team) => (
                    <div
                        key={team.id}
                        onClick={() => handleTeamSelect(team.id)}
                        className={`group flex flex-col items-center p-8 bg-slate-900/80 backdrop-blur-md rounded-2xl shadow-lg border-t-4 ${team.borderColor} hover:border-t-[6px] transition-all duration-300 cursor-pointer ${team.bgColor} hover:-translate-y-1 hover:shadow-xl ${team.shadowColor}`}
                    >
                        <div className={`p-4 bg-slate-950 rounded-full shadow-inner mb-4 group-hover:scale-110 transition-transform border border-slate-800`}>
                            <team.icon className={`w-8 h-8 ${team.color}`} />
                        </div>
                        <h2 className="text-xl font-bold text-slate-100">{team.name}</h2>
                        <p className="text-sm text-slate-400 text-center mt-2 group-hover:text-slate-300">{team.description}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderJoinScenarioScreen = () => {
        const team = teams.find(t => t.id === selectedTeam);
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-4 relative z-10">
                <div className="flex flex-col space-y-6 p-10 bg-slate-900/90 backdrop-blur-xl rounded-2xl shadow-2xl max-w-md w-full border border-slate-700 relative overflow-hidden">
                    {/* Decorative header line */}
                    <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-${team ? team.color.replace('text-', '') : 'blue-500'} to-transparent`} />
                    
                    <div className="text-center space-y-4">
                        <div className="inline-flex p-4 bg-slate-950 rounded-full mb-2 border border-slate-800 shadow-inner">
                            {team ? <team.icon className={`w-10 h-10 ${team.color}`} /> : <LogIn className="w-10 h-10 text-slate-400" />}
                        </div>
                        <div>
                            <h2 className="text-3xl font-bold text-white tracking-tight">
                                {team ? team.name : 'Join Scenario'}
                            </h2>
                            <p className="text-slate-400 text-sm mt-1">AUTHENTICATION REQUIRED</p>
                        </div>
                    </div>
                    
                    <div className="space-y-5">
                        <div>
                            <label className="text-xs font-bold text-blue-400 uppercase tracking-widest ml-1">Enter Access Key</label>
                            <input
                                type="text"
                                placeholder="ALPHA-731"
                                value={scenarioCode}
                                onChange={(e) => setScenarioCode(e.target.value.toUpperCase())}
                                className="w-full px-4 py-4 mt-2 bg-slate-950 border border-slate-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-white text-xl tracking-[0.2em] font-mono text-center uppercase transition-all placeholder:text-slate-700"
                                autoFocus
                            />
                        </div>

                        <button
                            onClick={handleScenarioJoin}
                            disabled={!scenarioCode.trim()}
                            className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/20 hover:shadow-blue-500/30 hover:-translate-y-0.5 transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            ESTABLISH UPLINK
                        </button>
                    </div>
                    
                    <button
                        onClick={() => setUserRole(ROLES.WELCOME)}
                        className="text-xs text-slate-500 hover:text-slate-300 font-medium transition-colors uppercase tracking-wider"
                    >
                        Abort Sequence
                    </button>
                </div>
            </div>
        );
    };

    const renderDashboard = () => {
        const team = teams.find(t => t.id === userRole);
        
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] w-full px-4 relative z-10">
                <div className="p-12 bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-700 text-center space-y-8">
                    <div className="space-y-4">
                        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-500/10 text-green-500 mb-4 border border-green-500/30 animate-pulse">
                            <Command className="w-12 h-12" />
                        </div>
                        <h1 className="text-5xl font-black text-white tracking-tight">UPLINK ESTABLISHED</h1>
                        <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-600 to-transparent max-w-sm mx-auto" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left bg-slate-950/50 p-8 rounded-2xl border border-slate-800">
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Operational Role</p>
                            <div className="flex items-center gap-3 mt-2">
                                {team && <team.icon className={`w-6 h-6 ${team.color}`} />}
                                <span className="text-2xl font-bold text-white">
                                    {team ? team.name : userRole.toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Active Cipher</p>
                            <p className="text-2xl font-mono font-bold text-red-500 mt-2 tracking-wider">
                                {scenarioCode || 'TEST-MODE'}
                            </p>
                        </div>
                    </div>

                    <p className="text-slate-400 max-w-lg mx-auto">
                        Connected to the secure operations network. Awaiting mission parameters from command...
                    </p>

                    <button
                        onClick={() => {
                            setUserRole(ROLES.WELCOME);
                            setScenarioCode('');
                            setSelectedTeam(null);
                        }}
                        className="py-3 px-8 bg-transparent border border-red-500/50 text-red-500 font-bold rounded-xl hover:bg-red-500/10 hover:border-red-500 transition-all"
                    >
                        TERMINATE SESSION
                    </button>
                </div>
            </div>
        );
    };

    // --- Main Render ---
    let content;
    switch (userRole) {
        case ROLES.WELCOME:
            content = renderWelcomeScreen();
            break;
        case ROLES.JOIN_SCENARIO:
            content = renderJoinScenarioScreen();
            break;
        default:
            content = renderDashboard();
    }

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center font-sans text-slate-100 selection:bg-blue-500 selection:text-white overflow-hidden relative">
            {/* Star Background Layer */}
            <StarBackground />
            
            {/* Main Content Layer */}
            {content}
        </div>
    );
}