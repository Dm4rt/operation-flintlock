import React, { useEffect, useRef } from 'react';

const BINS = 512;
const GRID_LINES = 8;

const formatFreq = (hz) => {
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(2)} MHz`;
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(1)} kHz`;
  return `${hz.toFixed(0)} Hz`;
};

const generateNoiseFloor = (count, baseDb, jitter) => {
  const bins = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    bins[i] = baseDb + (Math.random() - 0.5) * jitter;
  }
  return bins;
};

const addPeak = (bins, centerFreq, span, peakFreqHz, peakWidthHz, peakStrength, frameValue) => {
  const startFreq = centerFreq - span / 2;
  const endFreq = centerFreq + span / 2;
  if (peakFreqHz < startFreq || peakFreqHz > endFreq) return;

  const hzPerBin = span / bins.length;
  const centerBin = ((peakFreqHz - startFreq) / span) * bins.length;
  const sigmaBins = (peakWidthHz / hzPerBin) * 0.4;
  const peakHeight = 18 + (peakStrength ?? 1) * 12;
  const jitter = Math.sin(frameValue * 0.05 + centerBin * 0.12) * 1.2;

  for (let i = 0; i < bins.length; i++) {
    const distance = (i - centerBin) / (sigmaBins || 1);
    const gaussian = Math.exp(-0.5 * distance * distance);
    bins[i] += gaussian * (peakHeight + jitter);
  }
};

export default function SpectrumCanvas({
  centerFreq = 100_000_000,
  span = 10_000_000,
  minDb = -120,
  maxDb = -20,
  bandwidthHz = 200_000,
  height = 220,
  transmissions = [],
  onChangeCenterFreq = () => {},
  onChangeSpan = () => {},
  isActive = true
}) {
  const canvasRef = useRef(null);
  const noiseRef = useRef(null);
  const frameRef = useRef(0);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = (frameValue = frameRef.current) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (!width || !height) return;

      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#040815');
      gradient.addColorStop(1, '#01040a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= GRID_LINES; i++) {
        const y = (height / GRID_LINES) * i;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Regenerate noise floor each frame for static-like randomness
      const bins = new Float32Array(BINS);
      for (let i = 0; i < BINS; i++) {
        // Base noise floor with random jitter
        bins[i] = -105 + (Math.random() - 0.5) * 15;
        // Add subtle temporal variation to peaks only
        const temporal = Math.sin(frameValue * 0.02 + i * 0.08) * 0.6;
        bins[i] += temporal;
      }

      transmissions.forEach((tx) => {
        addPeak(bins, centerFreq, span, tx.frequencyHz, tx.widthHz, tx.peakStrength, frameValue);
      });

      const normalize = (db) => {
        return Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb)));
      };

      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.6;
      ctx.shadowColor = '#1d4ed8';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      for (let i = 0; i < bins.length; i++) {
        const x = (i / (bins.length - 1)) * width;
        const y = height - normalize(bins[i]) * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (bandwidthHz > 0) {
        const startFreq = centerFreq - span / 2;
        const freqToX = (freq) => ((freq - startFreq) / span) * width;
        const half = bandwidthHz / 2;
        const startX = Math.max(0, freqToX(centerFreq - half));
        const endX = Math.min(width, freqToX(centerFreq + half));
        const bwWidth = Math.max(4, endX - startX);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.12)';
        ctx.fillRect(startX, 0, bwWidth, height);
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
        ctx.strokeRect(startX, 2, bwWidth, height - 4);
      }

      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= GRID_LINES; i++) {
        const x = (i / GRID_LINES) * width;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
      ctx.font = '10px "Space Mono", monospace';
      ctx.textAlign = 'center';
      const startFreq = centerFreq - span / 2;
      for (let i = 0; i <= GRID_LINES; i += 2) {
        const tickFreq = startFreq + (i / GRID_LINES) * span;
        const x = (i / GRID_LINES) * width;
        ctx.fillText(formatFreq(tickFreq), x, height - 6);
      }
    };

    const startAnimation = () => {
      if (animRef.current) return;
      const loop = () => {
        const next = frameRef.current + 1;
        frameRef.current = next;
        draw(next);
        animRef.current = requestAnimationFrame(loop);
      };
      animRef.current = requestAnimationFrame(loop);
    };

    const stopAnimation = () => {
      if (!animRef.current) return;
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    };

    draw(frameRef.current);
    if (isActive) startAnimation();

    const handleResize = () => {
      resize();
      draw(frameRef.current);
      if (isActive && !animRef.current) startAnimation();
      if (!isActive) stopAnimation();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      stopAnimation();
      window.removeEventListener('resize', handleResize);
    };
  }, [centerFreq, span, minDb, maxDb, bandwidthHz, transmissions, isActive]);

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
      const rawSpan = span * (1 + direction * 0.12);
      const newSpan = Math.max(2_000_000, Math.min(40_000_000, rawSpan));
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
    <div
      className="relative w-full rounded-lg border border-slate-900 bg-[#03060d] overflow-hidden shadow-inner shadow-black/40"
      style={{ height }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute inset-x-6 bottom-3 flex items-center justify-between text-[10px] font-mono text-slate-400 pointer-events-none">
        <span>Scroll: Zoom span</span>
        <span>Click: Retune center</span>
      </div>
    </div>
  );
}
