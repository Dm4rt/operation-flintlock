import React, { useEffect, useRef } from 'react';

const mapToColor = (value, min, max) => {
  const clamped = Math.max(min, Math.min(max, value));
  const ratio = (clamped - min) / (max - min);
  const r = Math.round(10 + ratio * 80);
  const g = Math.round(40 + ratio * 140);
  const b = Math.round(120 + ratio * 100);
  return `rgb(${r}, ${g}, ${b})`;
};

const ROW_HEIGHT = 3;

export default function WaterfallCanvas({ fftData = [], minDb = -130, maxDb = -20, height = 320 }) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const rowsRef = useRef([]);
  const maxRowsRef = useRef(0);

  const drawRows = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);

    if (!rowsRef.current.length) return;
    const binWidth = width / rowsRef.current[0].length;
    const totalRows = rowsRef.current.length;

    rowsRef.current.forEach((row, rowIndex) => {
      const y = height - (totalRows - rowIndex) * ROW_HEIGHT;
      row.forEach((color, column) => {
        ctx.fillStyle = color;
        ctx.fillRect(column * binWidth, y, binWidth + 1, ROW_HEIGHT + 1);
      });
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctxRef.current = ctx;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
      ctx.scale(dpr, dpr);
      maxRowsRef.current = Math.max(1, Math.floor(canvas.clientHeight / ROW_HEIGHT));
      drawRows();
    };

    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (!fftData.length || !canvasRef.current) return;
    const colors = fftData.map((value) => mapToColor(value, minDb, maxDb));
    const maxRows = maxRowsRef.current || Math.floor(canvasRef.current.clientHeight / ROW_HEIGHT) || 1;
    rowsRef.current = [...rowsRef.current.slice(-(maxRows - 1)), colors];
    drawRows();
  }, [fftData, minDb, maxDb]);

  return (
    <div
      className="relative w-full rounded-lg border border-slate-900 bg-[#02050b] overflow-hidden shadow-inner shadow-black/40"
      style={{ height }}
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute inset-x-4 top-2 text-[10px] uppercase tracking-widest text-slate-500 pointer-events-none">
        Waterfall Persistence
      </div>
    </div>
  );
}
