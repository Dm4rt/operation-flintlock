// routes / view states
export const VIEWS = {
    HOME: 'home',
    JOIN: 'join',
    ADMIN: 'admin',
    DASHBOARD: 'dashboard'
};

// lucide icons for teams
import { LogIn, Command, Cpu, Compass, Radar, Zap } from "lucide-react";

// teams with icon, color, and descriptive metadata used by TeamCard
export const TEAMS = [
    {
        id: 'mission_cmd',
        name: 'Mission Command',
        icon: Command,
        description: 'Central Coordination (USSPACECOM)',
        color: 'text-blue-400',
        hex: '#60A5FA',
        borderColor: 'border-blue-600',
        shadowColor: 'shadow-blue-500/20'
    },
    {
        id: 'intel',
        name: 'Intel',
        icon: Compass,
        description: 'Threat and Target Analysis',
        color: 'text-emerald-400',
        hex: '#34D399',
        borderColor: 'border-emerald-600',
        shadowColor: 'shadow-emerald-500/20'
    },
    {
        id: 'cyber',
        name: 'Cyber',
        icon: Cpu,
        description: 'Cyber Defense and Offense',
        color: 'text-violet-400',
        hex: '#A78BFA',
        borderColor: 'border-violet-600',
        shadowColor: 'shadow-violet-500/20'
    },
    {
        id: 'sda',
        name: 'Space Ops - SDA',
        icon: Radar,
        description: 'Space Domain Awareness',
        color: 'text-orange-400',
        hex: '#FB923C',
        borderColor: 'border-orange-600',
        shadowColor: 'shadow-orange-500/20'
    },
    {
        id: 'ew',
        name: 'Space Ops - EW',
        icon: Zap,
        description: 'Electronic Warfare Operations',
        color: 'text-rose-400',
        hex: '#FB7185',
        borderColor: 'border-rose-600',
        shadowColor: 'shadow-rose-500/20'
    },
];

// admin role icon (used in UI directly — not part of TEAMS)
export const ADMIN_ICON = LogIn;
