import React, { useRef, useEffect } from 'react';

interface WaveformVisualizerProps {
  isRecording: boolean;
  isPaused: boolean;
  visualizerData: Uint8Array;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  isRecording,
  isPaused,
  visualizerData
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Vẽ sóng tĩnh (Idle) khi không ghi âm hoặc tạm dừng
    if (!isRecording || isPaused) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.bezierCurveTo(
        canvas.width / 4, canvas.height / 2 - 5,
        canvas.width * 0.75, canvas.height / 2 + 5,
        canvas.width, canvas.height / 2
      );
      ctx.stroke();
      return;
    }

    // Vẽ sóng âm động dựa trên dữ liệu tần số
    const bufferLength = visualizerData.length;
    if (bufferLength === 0) return;

    const barWidth = (canvas.width / bufferLength) * 2.2;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const value = visualizerData[i];
      const percent = value / 255;
      const barHeight = percent * canvas.height * 0.85;

      // Tạo màu gradient động chuyển từ tím sang hồng ngoại
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
      gradient.addColorStop(0, '#6C63FF');
      gradient.addColorStop(0.5, '#EC4899');
      gradient.addColorStop(1, '#FF5D73');

      ctx.fillStyle = gradient;

      // Vẽ thanh sóng đối xứng từ giữa canvas
      const y = (canvas.height - barHeight) / 2;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, 6);
      ctx.fill();

      x += barWidth + 2.5;
    }
  }, [isRecording, isPaused, visualizerData]);

  return (
    <div className="w-full h-32 rounded-2xl bg-black/40 border border-borderCustom overflow-hidden flex items-center justify-center relative">
      <canvas
        ref={canvasRef}
        width={700}
        height={128}
        className="w-full h-full block"
      />
      {(!isRecording) && (
        <span className="absolute text-xs text-textMuted font-mono">
          Waveform analyzer standby
        </span>
      )}
    </div>
  );
};
