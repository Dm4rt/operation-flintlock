import React, { useEffect, useRef } from 'react';

/**
 * Lightweight waterfall with pregenerated noise rows.
 * No real-time processing—just cycles through a few static rows.
 */

const WATERFALL_BINS = 512;

// SDR++ style gradient (blue → white → yellow)
const colormap = [
  [0, 0, 20],
  [0, 0, 30],
  [0, 0, 50],
  [0, 0, 91],
  [1, 3, 138],
  [2, 7, 168],
  [3, 18, 194],
  [5, 32, 206],
  [12, 44, 199],
  [18, 57, 176],
  [23, 65, 157],
  [39, 82, 135],
  [56, 100, 120],
  [81, 125, 105],
  [104, 142, 96],
  [138, 164, 88],
  [172, 187, 84],
  [206, 211, 84],
  [230, 228, 98],
  [252, 244, 114],
  [255, 253, 140],
  [255, 254, 168],
  [255, 254, 203],
  [255, 254, 237],
  [255, 254, 254]
];

const getColor = (value) => {
  const index = Math.floor(value * (colormap.length - 1));
  const clamped = Math.max(0, Math.min(colormap.length - 1, index));
  return colormap[clamped];
};

// Pregenerate a single noise row
const generateNoiseRow = (count) => {
  const row = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    row[i] = 0.2 + Math.random() * 0.3; // normalized [0, 1]
  }
  return row;
};

export default function WaterfallCanvas({
  height = 380,
  transmissions = [],
  centerFreq = 100_000_000,
  span = 10_000_000
}) {
  const canvasRef = useRef(null);
  const frameCountRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    resize();

    const drawRow = () => {
      const width = canvas.width;
      const height = canvas.height;
      if (!width || !height) return;

      // Shift existing image down by 1 pixel
      ctx.drawImage(canvas, 0, 0, width, height - 1, 0, 1, width, height - 1);

      // Build new row based on noise + peaks
      const rowData = ctx.createImageData(width, 1);
      const buffer = rowData.data;
      const noiseRow = generateNoiseRow(width);

      transmissions.forEach(tx => {
        const startFreq = centerFreq - span / 2;
        const endFreq = centerFreq + span / 2;
        if (tx.frequencyHz < startFreq || tx.frequencyHz > endFreq) return;
        const centerX = ((tx.frequencyHz - startFreq) / span) * width;
        const sigma = (tx.widthHz / span) * width * 0.4;
        const strength = tx.peakStrength ?? 1.0;
        for (let x = 0; x < width; x++) {
          const distance = (x - centerX) / (sigma || 1);
          const gaussian = Math.exp(-0.5 * distance * distance);
          noiseRow[x] = Math.min(1, noiseRow[x] + gaussian * 0.6 * strength);
        }
      });

      for (let x = 0; x < width; x++) {
        const value = noiseRow[x];
        const [r, g, b] = getColor(value);
        const idx = x * 4;
        buffer[idx] = r;
        buffer[idx + 1] = g;
        buffer[idx + 2] = b;
        buffer[idx + 3] = 255;
      }

      ctx.putImageData(rowData, 0, 0);
      frameCountRef.current += 1;
    };

    drawRow();
    const interval = setInterval(drawRow, 80);

    const handleResize = () => {
      resize();
      draw();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      clearInterval(interval);
      window.removeEventListener('resize', handleResize);
    };
  }, [transmissions, centerFreq, span]);

  return (
    <div
      className="relative w-full rounded-lg border border-slate-900 bg-black overflow-hidden shadow-inner shadow-black/40"
      style={{ height }}
    >
      <canvas ref={canvasRef} className="w-full h-full block" style={{ imageRendering: 'auto', display: 'block' }} />
    </div>
  );
}
