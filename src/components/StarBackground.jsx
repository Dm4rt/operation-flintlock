import React, { useState, useEffect } from "react";

export default function StarBackground({ className }) {
    const [stars, setStars] = useState([]);

    useEffect(() => {
        const starCount = 75;
        const arr = [];
        for (let i = 0; i < starCount; i++) {
            arr.push({
                id: i,
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                size: `${Math.random() * 2 + 1}px`,
                duration: `${Math.random() * 10 + 20}s`,
                opacity: Math.random() * 0.7 + 0.3,
            });
        }
        setStars(arr);
    }, []);

    return (
        <div className={className || "fixed inset-0 overflow-hidden pointer-events-none z-0"}>
            <style>{`
                @keyframes floatUp {
                    0% { transform: translateY(100vh); opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { transform: translateY(-10vh); opacity: 0; }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 0.4; }
                    50% { opacity: 1; }
                }
            `}</style>

            <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-[#050b14] to-slate-950"></div>

            {stars.map(star => (
                <div
                    key={star.id}
                    className="absolute bg-white rounded-full"
                    style={{
                        left: star.left,
                        top: star.top,
                        width: star.size,
                        height: star.size,
                        opacity: star.opacity,
                        animation: `floatUp ${star.duration} linear infinite, pulse 3s ease-in-out infinite`,
                    }}
                />
            ))}

            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 mix-blend-overlay"></div>
        </div>
    );
}
