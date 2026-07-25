import React, { useState, useEffect } from 'react';
import { Network, Server, Cpu, Database, Eye } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const [cpuUsage, setCpuUsage] = useState(2);
  const [ramUsage, setRamUsage] = useState(42);

  // Hiển thị số liệu mô phỏng nhẹ nhưng ổn định
  useEffect(() => {
    const interval = setInterval(() => {
      setCpuUsage(prev => Math.max(1, Math.min(8, prev < 5 ? prev + 1 : prev - 1)));
      setRamUsage(prev => Math.max(38, Math.min(50, prev < 45 ? prev + 1 : prev - 1)));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="flex items-center justify-between px-6 py-2.5 bg-card/25 border-t border-borderCustom text-[11px] text-textMuted rounded-b-2xl">
      {/* Left side: System status */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-success rounded-full"></span>
          <span className="font-semibold text-textSecondary uppercase tracking-wider">SYSTEM: ONLINE</span>
        </div>
        <div className="h-3 w-px bg-borderCustom"></div>
        <div className="flex items-center gap-1.5">
          <Network className="w-3.5 h-3.5 text-textMuted" />
          <span>Speech Recognition:</span>
          <span className="text-textSecondary font-semibold">Web Speech API (Google)</span>
        </div>
        <div className="h-3 w-px bg-borderCustom"></div>
        <div className="flex items-center gap-1.5">
          <Server className="w-3.5 h-3.5 text-textMuted" />
          <span>Whisper Engine:</span>
          <span className="text-textSecondary font-semibold">Python (Local Chunking)</span>
        </div>
      </div>

      {/* Right side: Performance metrics */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-textMuted" />
          <span>CPU:</span>
          <span className="text-textSecondary font-semibold">{cpuUsage}%</span>
        </div>
        <div className="h-3 w-px bg-borderCustom"></div>
        <div className="flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-textMuted" />
          <span>Memory:</span>
          <span className="text-textSecondary font-semibold">{ramUsage} MB</span>
        </div>
        <div className="h-3 w-px bg-borderCustom"></div>
        <div className="flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-textMuted" />
          <span>Session IP:</span>
          <span className="text-textSecondary font-semibold">127.0.0.1 (Localhost)</span>
        </div>
      </div>
    </footer>
  );
};
