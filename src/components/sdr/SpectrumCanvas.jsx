import React, { useEffect, useRef } from 'react';

const formatFrequency = (hz) => {
  if (!hz && hz !== 0) return '---';
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(2)} MHz`;
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(1)} kHz`;
  return `${hz.toFixed(0)} Hz`;
};

export default function SpectrumCanvas({
  fftData = [],
  centerFreq,
  span,
  onChangeCenterFreq = () => {},
  onChangeSpan = () => {}
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const handleResize = () => {
      resize();
      draw();
    };

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#040815');
      gradient.addColorStop(1, '#01040a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(59, 130, 246, 0.25)';
        ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 5; i++) {
        const y = (height / 5) * i;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      if (!fftData.length) return;
      const minDb = -130;
      const maxDb = -30;
      const normalize = (value) => (value - minDb) / (maxDb - minDb);

        ctx.lineWidth = 2;
        ctx.strokeStyle = '#60a5fa';
        ctx.shadowColor = '#1d4ed8';
        ctx.shadowBlur = 8;
      ctx.beginPath();
      fftData.forEach((value, index) => {
        const x = (index / (fftData.length - 1)) * width;
        const y = height - normalize(value) * height;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      ctx.fillStyle = 'rgba(148, 163, 184, 0.8)';
      ctx.font = '10px "Space Mono", monospace';
      ctx.textAlign = 'center';
      for (let i = 0; i <= 4; i++) {
        const tick = ((i / 4) - 0.5) * span + centerFreq;
        const x = (i / 4) * width;
        ctx.fillText(formatFrequency(tick), x, height - 8);
      }
    };

    draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fftData, centerFreq, span]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleClick = (event) => {
      const rect = canvas.getBoundingClientRect();
      const percent = (event.clientX - rect.left) / rect.width;
      const delta = (percent - 0.5) * span;
      onChangeCenterFreq(Math.round(centerFreq + delta));
    };

    const handleWheel = (event) => {
      event.preventDefault();
      const direction = event.deltaY > 0 ? 1 : -1;
      const newSpan = Math.max(100_000, span * (1 + direction * 0.1));
      onChangeSpan(Math.round(newSpan));
    };

    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [centerFreq, span, onChangeCenterFreq, onChangeSpan]);

  return (
    <div className="relative w-full h-56 rounded-lg border border-slate-900 bg-[#03060d] overflow-hidden shadow-inner shadow-black/40">
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute inset-x-6 bottom-3 flex items-center justify-between text-[10px] font-mono text-slate-400 pointer-events-none">
        <span>Scroll: Zoom span</span>
        <span>Click: Retune center</span>
      </div>
    </div>
  );
}
