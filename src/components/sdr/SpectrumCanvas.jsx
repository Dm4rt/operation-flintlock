import React, { useEffect, useRef } from 'react';

/**
 * Lightweight spectrum display with pregenerated noise + fixed peaks.
 * No real-time FFT, just a static pattern that updates occasionally.
 */

const BINS = 512;
const GRID_LINES = 8;

const formatFreq = (hz) => {
  if (hz >= 1_000_000) return `${(hz / 1_000_000).toFixed(2)} MHz`;
  if (hz >= 1_000) return `${(hz / 1_000).toFixed(1)} kHz`;
  return `${hz.toFixed(0)} Hz`;
};

// Pregenerate a noise floor pattern once
const generateNoiseFloor = (count, baseDb, jitter) => {
  const bins = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    bins[i] = baseDb + (Math.random() - 0.5) * jitter;
  }
  return bins;
};

// Add a fake peak at a given frequency
const addPeak = (bins, centerFreq, span, peakFreqHz, peakWidthHz, peakStrength, animFrame) => {
  const startFreq = centerFreq - span / 2;
  const endFreq = centerFreq + span / 2;
  if (peakFreqHz < startFreq || peakFreqHz > endFreq) return; // out of view

  const hzPerBin = span / bins.length;
  const centerBin = ((peakFreqHz - startFreq) / span) * bins.length;
  const sigmaBins = (peakWidthHz / hzPerBin) * 0.4;
  const peakHeight = 18 + peakStrength * 12; // scale peak by strength
  const jitter = Math.sin(animFrame * 0.05 + centerBin * 0.1) * 1.5; // animate peaks

  for (let i = 0; i < bins.length; i++) {
    const distance = (i - centerBin) / sigmaBins;
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
  onChangeSpan = () => {}
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
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const draw = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      ctx.clearRect(0, 0, width, height);

      // Background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#040815');
      gradient.addColorStop(1, '#01040a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Horizontal grid
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= GRID_LINES; i++) {
        const y = (height / GRID_LINES) * i;
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      // Generate noise floor once per mount (or regenerate on prop change)
      if (!noiseRef.current || noiseRef.current.length !== BINS) {
        noiseRef.current = generateNoiseFloor(BINS * 2, -105, 12);
      }

      const source = noiseRef.current;
      const bins = new Float32Array(BINS);
      const scrollOffset = frameRef.current % source.length;
      for (let i = 0; i < BINS; i++) {
        const idx = (i + scrollOffset) % source.length;
        bins[i] = source[idx] + Math.sin((frameRef.current * 0.02) + (i * 0.08)) * 2;
      }

      // Add fake peaks for each transmission (always visible, regardless of tuning)
      transmissions.forEach(tx => {
        addPeak(bins, centerFreq, span, tx.frequencyHz, tx.widthHz, tx.peakStrength ?? 1.0, frameRef.current);
      });

      frameRef.current += 1;

      // Normalize bins to [0, 1]
      const normalize = (db) => {
        return Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb)));
      };

      // Draw spectrum line
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

      // Draw bandwidth window overlay
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
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, 2, bwWidth, height - 4);
      }

      // Center tuning line
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(width / 2, 0);
      ctx.lineTo(width / 2, height);
      ctx.stroke();

      // Vertical grid + frequency ticks
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

    animRef.current = requestAnimationFrame(function loop() {
      draw();
      animRef.current = requestAnimationFrame(loop);
    });

    const handleResize = () => {
      resize();
      draw();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [centerFreq, span, minDb, maxDb, bandwidthHz, transmissions]);

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
      const newSpan = Math.max(500_000, Math.min(160_000_000, span * (1 + direction * 0.15)));
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
