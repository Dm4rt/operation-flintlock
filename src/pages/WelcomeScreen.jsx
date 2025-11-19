import React from "react";
import { TEAMS, ADMIN_ICON } from "../utils/constants";
import TeamCard from "../components/TeamCard";
import StarBackground from "../components/StarBackground";
import { useNavigate } from "react-router-dom";

export default function WelcomeScreen() {
    const navigate = useNavigate();

    return (
        <div className="relative z-20 flex flex-col items-center space-y-12 py-12 px-4 max-w-7xl mx-auto w-full animate-fade-in">
            <StarBackground className="absolute inset-0 -z-10" />

            <div className="text-center space-y-6">
                <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-white to-blue-400 tracking-tight drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                    OPERATION <span className="text-blue-500">FLINTLOCK</span>
                </h1>
                <p className="text-2xl text-slate-400 font-light tracking-wide">
                    SECURE TERMINAL ACCESS
                </p>
            </div>

            {/* TEAM SELECTION GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                <div
                    onClick={() => navigate("/admin")}
                    className={`group flex flex-col items-center p-8 bg-slate-900/70 rounded-2xl 
                    border-t-4 border-slate-700 shadow transition-all duration-300 cursor-pointer
                    hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-500/10 hover:bg-slate-900`}
                >
                    <div className="p-4 bg-slate-800 rounded-full shadow-inner mb-4 border border-slate-700 group-hover:scale-110 transition-transform">
                        <ADMIN_ICON className="w-10 h-10 stroke-current text-slate-200" />
                    </div>

                    <h2 className="text-xl font-bold text-slate-100">Admin Panel</h2>

                    <p className="text-sm text-slate-400 text-center mt-2">
                        Generate & Control Scenarios
                    </p>
                </div>

                {TEAMS.map((team) => (
                    <TeamCard key={team.id} team={team} />
                ))}
            </div>
        </div>
    );
}
