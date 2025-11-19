import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function TeamCard({ team }) {
    const navigate = useNavigate();

    // Provide a safe default Icon component when team.icon is missing/undefined.
    // JSX requires component variables to be capitalized. Use a local `Icon` variable
    // that will reference the provided icon component or a fallback SVG.
    const Icon = team?.icon || (() => (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 14.5h-2V13H8.5V11h2.5V8.5h2v2.5H15v2h-2v3.5z" />
        </svg>
    ));

    const iconWrapperRef = useRef(null);

    useEffect(() => {
        // Debug: log computed styles for the rendered SVG to help identify
        // why icons may be invisible until hover. This runs in dev and prints to console.
        const el = iconWrapperRef.current;
        if (!el) return;
        const svg = el.querySelector('svg');
        if (!svg) return;
        const cs = window.getComputedStyle(svg);
        console.log(`TeamCard[${team.id}] svg computed: color=${cs.color}, opacity=${cs.opacity}, display=${cs.display}, stroke=${cs.getPropertyValue('stroke')}`);
    }, [team]);

    return (
        <div
            onClick={() => navigate(`/join/${team.id}`)}
            className={`team-card group flex flex-col items-center p-8 bg-slate-900/70 rounded-2xl 
            border-t-4 ${team.borderColor || "border-slate-700"}
            shadow transition-all duration-300 cursor-pointer
            hover:-translate-y-1 hover:shadow-xl hover:${team.shadowColor || "shadow-blue-500/20"}
            hover:bg-slate-900`}
        >
            <div ref={iconWrapperRef} className="p-4 bg-slate-950 rounded-full shadow-inner mb-4 border border-slate-800 group-hover:scale-110 transition-transform">
                {/* lucide icons use stroke=currentColor; ensure stroke uses current text color
                    Also pass inline style color as a fallback (hex) so the icon remains visible
                    even if Tailwind classes are missing/removed by purging. */}
                <Icon
                    className={`w-10 h-10 stroke-current opacity-100 ${team?.color || 'text-white'}`}
                    strokeWidth={1.8}
                    stroke="currentColor"
                    fill="none"
                    style={{ color: team?.hex || undefined, opacity: 1 }}
                />
            </div>

            <h2 className="text-xl font-bold text-slate-100">{team.name}</h2>

            <p className="text-sm text-slate-400 text-center mt-2 group-hover:text-slate-300">
                {team.description}
            </p>
        </div>
    );
}
