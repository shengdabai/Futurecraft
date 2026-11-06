import React, { useEffect, useRef } from 'react';
import { Mic } from 'lucide-react';

interface AIAnchorProps {
  isPlaying: boolean;
  text?: string;
}

export const AIAnchor: React.FC<AIAnchorProps> = ({ isPlaying }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let hue = 0;

    const bars = 20;
    const barWidth = canvas.width / bars;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Background/Avatar Placeholder
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      const gradient = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, 120);
      gradient.addColorStop(0, `hsla(${hue}, 70%, 60%, 0.8)`);
      gradient.addColorStop(1, `hsla(${hue + 40}, 70%, 30%, 0)`);
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      // Pulse effect when playing
      const radius = isPlaying ? 80 + Math.sin(Date.now() / 100) * 10 : 80;
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Visualizer Bars
      if (isPlaying) {
        for (let i = 0; i < bars; i++) {
          const barHeight = Math.random() * 40 + 10;
          const x = i * barWidth;
          const y = canvas.height - barHeight;
          
          ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5 + 0.2})`;
          ctx.fillRect(x, y, barWidth - 2, barHeight);
        }
      }

      hue = (hue + 0.5) % 360;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationId);
  }, [isPlaying]);

  return (
    <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
      <canvas 
        ref={canvasRef} 
        width={600} 
        height={340} 
        className="w-full h-full object-cover"
      />
      <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
        <div className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
        <span className="text-xs font-medium text-white tracking-wider uppercase">
          {isPlaying ? 'AI 主播直播中' : 'AI 主播待机中'}
        </span>
      </div>
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <Mic className="w-12 h-12 text-white/20" />
        </div>
      )}
    </div>
  );
};