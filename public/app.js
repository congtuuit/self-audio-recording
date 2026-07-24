// --- VOICE CRAFT STUDIO APP LOGIC ---

// DOM Elements
const btnStart = document.getElementById('btnStart');
const btnPause = document.getElementById('btnPause');
const btnResume = document.getElementById('btnResume');
const btnStop = document.getElementById('btnStop');
const timerDisplay = document.getElementById('timerDisplay');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const recordingNameInput = document.getElementById('recordingName');
const languageSelect = document.getElementById('languageSelect');
const transcriptBox = document.getElementById('transcriptBox');
const charCounter = document.getElementById('charCounter');
const btnCopyTranscript = document.getElementById('btnCopyTranscript');
const btnClearTranscript = document.getElementById('btnClearTranscript');
const speechStatus = document.getElementById('speechStatus');
const recordingsList = document.getElementById('recordingsList');
const btnRefreshLibrary = document.getElementById('btnRefreshLibrary');
const canvas = document.getElementById('visualizerCanvas');
const canvasCtx = canvas.getContext('2d');
const toast = document.getElementById('toast');

// State Variables
let audioContext = null;
let activeStreams = []; // Lưu danh sách các streams cần cleanup khi stop
let audioSourceNode = null;
let analyserNode = null;
let scriptProcessorNode = null;
let pcmBuffers = []; // Lưu các mảng Float32Array PCM samples
let recordingStartTime = 0;
let elapsedTime = 0;
let timerInterval = null;
let isRecording = false;
let isPaused = false;
let sampleRate = 44100;

// Web Speech Recognition
let recognition = null;
let finalTranscript = '';
let interimTranscript = '';
let speechActive = false;

// --- 1. INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
  initSpeechRecognition();
  loadRecordingsLibrary();
  drawIdleVisualizer();

  btnStart.addEventListener('click', startRecording);
  btnPause.addEventListener('click', pauseRecording);
  btnResume.addEventListener('click', resumeRecording);
  btnStop.addEventListener('click', stopRecording);
  btnCopyTranscript.addEventListener('click', copyTranscript);
  btnClearTranscript.addEventListener('click', clearTranscript);
  btnRefreshLibrary.addEventListener('click', loadRecordingsLibrary);
  languageSelect.addEventListener('change', onLanguageChange);
});

// --- 2. WEB SPEECH RECOGNITION (TRANSCRIPT) ---

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    speechStatus.textContent = '⚠️ Trình duyệt không hỗ trợ Web Speech API (khuyên dùng Chrome/Edge)';
    speechStatus.style.color = '#ef4444';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = languageSelect.value;

  recognition.onresult = (event) => {
    interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    updateTranscriptUI();
  };

  recognition.onerror = (event) => {
    console.warn('Speech Recognition error:', event.error);
    if (event.error === 'not-allowed') {
      speechStatus.textContent = '❌ Chưa cấp quyền micro cho Speech Recognition';
    }
  };

  recognition.onend = () => {
    // Tự động khởi động lại nếu vẫn đang trong chế độ thu âm
    if (speechActive && isRecording && !isPaused) {
      try {
        recognition.start();
      } catch (e) {
        console.warn('Cannot restart recognition:', e);
      }
    }
  };

  speechStatus.textContent = '⚡ Web Speech API (Đã sẵn sàng)';
}

function onLanguageChange() {
  if (recognition) {
    recognition.lang = languageSelect.value;
    showToast(`Đã đổi ngôn ngữ transcript sang: ${languageSelect.options[languageSelect.selectedIndex].text}`);
  }
}

function updateTranscriptUI() {
  if (!finalTranscript && !interimTranscript) {
    transcriptBox.innerHTML = '<p class="placeholder-text">Chữ thu âm từ giọng nói của bạn sẽ tự động xuất hiện tại đây khi bạn bắt đầu nói...</p>';
    charCounter.textContent = '0 ký tự';
    return;
  }

  transcriptBox.innerHTML = `
    <span class="transcript-final">${escapeHtml(finalTranscript)}</span>
    <span class="transcript-interim">${escapeHtml(interimTranscript)}</span>
  `;
  
  // Tự động cuộn xuống dòng mới nhất
  transcriptBox.scrollTop = transcriptBox.scrollHeight;

  const totalLength = (finalTranscript + interimTranscript).length;
  charCounter.textContent = `${totalLength} ký tự`;
}

function copyTranscript() {
  const fullText = (finalTranscript + ' ' + interimTranscript).trim();
  if (!fullText) {
    showToast('Không có nội dung transcript để copy!');
    return;
  }
  navigator.clipboard.writeText(fullText);
  showToast('📋 Đã copy transcript vào clipboard!');
}

function clearTranscript() {
  finalTranscript = '';
  interimTranscript = '';
  updateTranscriptUI();
  showToast('🗑️ Đã xóa nội dung transcript trên màn hình');
}

// --- 3. AUDIO RECORDING ENGINE (PCM WAV) ---

async function startRecording() {
  const audioSourceMode = document.getElementById('audioSourceSelect').value;
  activeStreams = [];

  // Khởi tạo AudioContext
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  sampleRate = audioContext.sampleRate;

  let finalAudioStream = null;

  try {
    if (audioSourceMode === 'mic') {
      // 1. CHỈ MICRO
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreams.push(micStream);
      finalAudioStream = micStream;
    } else if (audioSourceMode === 'system') {
      // 2. CHỈ ÂM THANH HỆ THỐNG (LOA/MÁY TÍNH)
      showToast('ℹ️ Vui lòng chọn màn hình/thẻ và TÍCH VÀO "Chia sẻ âm thanh"!');
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      activeStreams.push(displayStream);

      const systemAudioTrack = displayStream.getAudioTracks()[0];
      if (!systemAudioTrack) {
        throw new Error('Bạn chưa tích chọn "Chia sẻ âm thanh hệ thống" (Share Audio) khi chọn màn hình!');
      }

      // Dừng video track vì ta chỉ cần âm thanh
      displayStream.getVideoTracks().forEach(t => t.stop());

      finalAudioStream = new MediaStream([systemAudioTrack]);
    } else if (audioSourceMode === 'both') {
      // 3. CẢ MICRO VÀ ÂM THANH HỆ THỐNG (MIXED)
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreams.push(micStream);

      showToast('ℹ️ Vui lòng chọn màn hình/thẻ và TÍCH VÀO "Chia sẻ âm thanh"!');
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      activeStreams.push(displayStream);

      const systemAudioTrack = displayStream.getAudioTracks()[0];
      if (!systemAudioTrack) {
        throw new Error('Bạn chưa tích chọn "Chia sẻ âm thanh hệ thống" (Share Audio) khi chọn màn hình!');
      }

      // Dừng video track không cần thiết
      displayStream.getVideoTracks().forEach(t => t.stop());

      // Trộn 2 luồng âm thanh bằng AudioContext Destination
      const micSource = audioContext.createMediaStreamSource(micStream);
      const systemSource = audioContext.createMediaStreamSource(new MediaStream([systemAudioTrack]));
      const mixedDestination = audioContext.createMediaStreamDestination();

      micSource.connect(mixedDestination);
      systemSource.connect(mixedDestination);

      finalAudioStream = mixedDestination.stream;
    }
  } catch (err) {
    showToast(`❌ Lỗi: ${err.message || 'Không thể truy cập nguồn âm thanh!'}`);
    console.error('Audio source capture error:', err);
    // Cleanup nếu có stream đã xin
    activeStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
    if (audioContext) audioContext.close();
    return;
  }

  audioSourceNode = audioContext.createMediaStreamSource(finalAudioStream);
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 256;

  // Dùng ScriptProcessorNode để ghi nhận raw PCM samples
  const bufferSize = 4096;
  scriptProcessorNode = audioContext.createScriptProcessor(bufferSize, 1, 1);

  pcmBuffers = [];
  scriptProcessorNode.onaudioprocess = (e) => {
    if (!isRecording || isPaused) return;
    const inputBuffer = e.inputBuffer.getChannelData(0); // Mono channel
    pcmBuffers.push(new Float32Array(inputBuffer));
  };

  audioSourceNode.connect(analyserNode);
  analyserNode.connect(scriptProcessorNode);
  scriptProcessorNode.connect(audioContext.destination);

  // Bắt đầu Speech Recognition nếu thu từ Micro hoặc Mixed
  if (recognition) {
    speechActive = true;
    try {
      recognition.start();
    } catch (e) {
      console.warn('Speech recognition start failed:', e);
    }
  }

  // Update State
  isRecording = true;
  isPaused = false;
  recordingStartTime = Date.now() - elapsedTime;
  startTimer();

  // Update UI
  btnStart.disabled = true;
  btnPause.disabled = false;
  btnPause.style.display = 'inline-flex';
  btnResume.style.display = 'none';
  btnStop.disabled = false;
  
  statusBadge.className = 'status-badge recording';
  statusText.textContent = 'Đang thu âm...';

  drawVisualizer();
  showToast('🔴 Đang thu âm...');
}

function pauseRecording() {
  if (!isRecording || isPaused) return;
  isPaused = true;
  clearInterval(timerInterval);

  if (audioContext && audioContext.state === 'running') {
    audioContext.suspend();
  }

  btnPause.style.display = 'none';
  btnResume.style.display = 'inline-flex';
  statusBadge.className = 'status-badge paused';
  statusText.textContent = 'Đã tạm dừng';
  showToast('⏸️ Đã tạm dừng thu âm');
}

function resumeRecording() {
  if (!isRecording || !isPaused) return;
  isPaused = false;
  
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }

  recordingStartTime = Date.now() - elapsedTime;
  startTimer();

  btnResume.style.display = 'none';
  btnPause.style.display = 'inline-flex';
  statusBadge.className = 'status-badge recording';
  statusText.textContent = 'Đang thu âm...';

  drawVisualizer();
  showToast('▶️ Tiếp tục thu âm');
}

async function stopRecording() {
  if (!isRecording) return;

  isRecording = false;
  isPaused = false;
  speechActive = false;
  clearInterval(timerInterval);

  // Dừng Speech Recognition
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {}
  }

  // Dừng tất cả Media Streams & Audio Tracks
  activeStreams.forEach(stream => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  });
  activeStreams = [];

  if (scriptProcessorNode) scriptProcessorNode.disconnect();
  if (analyserNode) analyserNode.disconnect();
  if (audioSourceNode) audioSourceNode.disconnect();
  if (audioContext) audioContext.close();

  // Update UI trạng thái
  btnStart.disabled = false;
  btnPause.disabled = true;
  btnPause.style.display = 'inline-flex';
  btnResume.style.display = 'none';
  btnStop.disabled = true;

  statusBadge.className = 'status-badge';
  statusText.textContent = 'Đang lưu file...';

  // Chuyển PCM Buffers thành 16-bit WAV ArrayBuffer
  const wavBlob = encodeWAV(pcmBuffers, sampleRate);
  const fullTranscriptText = (finalTranscript + ' ' + interimTranscript).trim();
  const customName = recordingNameInput.value.trim();

  // Upload lên Node.js server
  await saveRecordingToServer(wavBlob, fullTranscriptText, customName);

  // Reset Timer
  elapsedTime = 0;
  timerDisplay.textContent = '00:00:00';
  statusBadge.className = 'status-badge';
  statusText.textContent = 'Sẵn sàng';

  drawIdleVisualizer();
}

// --- 4. WAV PCM ENCODER (BROWSER NATIVE) ---

function encodeWAV(buffers, sampleRate) {
  // Tính tổng độ dài sample
  let totalSamples = 0;
  for (let i = 0; i < buffers.length; i++) {
    totalSamples += buffers[i].length;
  }

  // Gộp các mảng Float32 thành 1 mảng duy nhất
  const mergedSamples = new Float32Array(totalSamples);
  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    mergedSamples.set(buffers[i], offset);
    offset += buffers[i].length;
  }

  // Khởi tạo ArrayBuffer chứa RIFF Header 44 bytes + PCM data
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* RIFF chunk size */
  view.setUint32(4, 36 + totalSamples * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count (Mono = 1) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sampleRate * 1 channel * 2 bytes) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (1 channel * 2 bytes) */
  view.setUint16(32, 2, true);
  /* bits per sample (16 bit) */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, totalSamples * 2, true);

  // Chuyển Float32 [-1.0, 1.0] thành Int16 PCM [-32768, 32767]
  let index = 44;
  for (let i = 0; i < mergedSamples.length; i++) {
    let s = Math.max(-1, Math.min(1, mergedSamples[i]));
    view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    index += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// --- 5. TIMER & VISUALIZER ---

function startTimer() {
  timerInterval = setInterval(() => {
    elapsedTime = Date.now() - recordingStartTime;
    const totalSeconds = Math.floor(elapsedTime / 1000);
    const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(totalSeconds % 60).padStart(2, '0');
    timerDisplay.textContent = `${hrs}:${mins}:${secs}`;
  }, 200);
}

function drawVisualizer() {
  if (!isRecording || isPaused) return;

  requestAnimationFrame(drawVisualizer);

  const bufferLength = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyserNode.getByteFrequencyData(dataArray);

  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

  const barWidth = (canvas.width / bufferLength) * 2.5;
  let barHeight;
  let x = 0;

  for (let i = 0; i < bufferLength; i++) {
    barHeight = (dataArray[i] / 255) * canvas.height;

    // Gradient màu sóng âm sinh động
    const gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, 0);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(0.5, '#ec4899');
    gradient.addColorStop(1, '#ef4444');

    canvasCtx.fillStyle = gradient;
    canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

    x += barWidth + 2;
  }
}

function drawIdleVisualizer() {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  canvasCtx.lineWidth = 2;
  canvasCtx.beginPath();
  canvasCtx.moveTo(0, canvas.height / 2);
  canvasCtx.lineTo(canvas.width, canvas.height / 2);
  canvasCtx.stroke();
}

// --- 6. SERVER API INTEGRATION ---

async function saveRecordingToServer(wavBlob, transcriptText, customName) {
  try {
    showToast('💾 Đang tải file lên server...');

    // Convert Blob to Base64
    const reader = new FileReader();
    reader.readAsDataURL(wavBlob);
    
    reader.onloadend = async () => {
      const base64Audio = reader.result;

      const payload = {
        audioBase64: base64Audio,
        transcript: transcriptText,
        customName: customName
      };

      const response = await fetch('/api/save-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();

      if (resData.success) {
        showToast(`✅ Đã lưu file thành công: ${resData.recording.filename}`);
        loadRecordingsLibrary();
      } else {
        showToast(`❌ Lỗi khi lưu file: ${resData.error}`);
      }
    };
  } catch (err) {
    console.error('Save recording error:', err);
    showToast('❌ Lỗi kết nối server khi lưu file!');
  }
}

async function loadRecordingsLibrary() {
  try {
    recordingsList.innerHTML = '<div class="loading-spinner">Đang tải danh sách...</div>';
    const res = await fetch('/api/recordings');
    const data = await res.json();

    if (!data.success || data.recordings.length === 0) {
      recordingsList.innerHTML = '<p class="placeholder-text" style="padding: 1rem;">Chưa có bản ghi nào được lưu trong thư mục recordings/</p>';
      return;
    }

    recordingsList.innerHTML = '';
    data.recordings.forEach(rec => {
      const dateStr = new Date(rec.createdAt).toLocaleString('vi-VN');
      const sizeKB = (rec.size / 1024).toFixed(1);

      const item = document.createElement('div');
      item.className = 'recording-item';
      item.innerHTML = `
        <div class="rec-info">
          <div class="rec-title">🎵 ${escapeHtml(rec.filename)}</div>
          <div class="rec-meta">
            <span>📅 ${dateStr}</span>
            <span>💾 ${sizeKB} KB</span>
          </div>
        </div>
        ${rec.transcript ? `<div class="rec-transcript-preview">📝 ${escapeHtml(rec.transcript)}</div>` : ''}
        <div class="rec-actions">
          <audio controls src="/recordings/${rec.filename}"></audio>
          <a href="/recordings/${rec.filename}" download="${rec.filename}" class="btn-ghost" title="Tải file WAV">⬇️ .WAV</a>
          <a href="/recordings/${rec.txtFilename}" download="${rec.txtFilename}" class="btn-ghost" title="Tải file Text">📄 .TXT</a>
          <button class="btn-ghost" onclick="copyText('${escapeQuotes(rec.transcript)}')" title="Copy transcript">📋 Copy</button>
          <button class="btn-ghost" onclick="deleteRecording('${rec.id}')" style="color: #ef4444;" title="Xóa bản ghi">🗑️ Xóa</button>
        </div>
      `;
      recordingsList.appendChild(item);
    });
  } catch (err) {
    console.error('Load library error:', err);
    recordingsList.innerHTML = '<p class="placeholder-text" style="color: #ef4444;">Không thể kết nối đến server để lấy danh sách bản ghi.</p>';
  }
}

async function deleteRecording(id) {
  if (!confirm(`Bạn có chắc muốn xóa bản ghi [${id}] không?`)) return;

  try {
    const res = await fetch(`/api/recordings/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('🗑️ Đã xóa bản ghi thành công');
      loadRecordingsLibrary();
    } else {
      showToast(`❌ Xóa thất bại: ${data.error}`);
    }
  } catch (err) {
    showToast('❌ Lỗi khi gửi yêu cầu xóa bản ghi');
  }
}

function copyText(text) {
  if (!text) {
    showToast('Bản ghi này không có transcript');
    return;
  }
  navigator.clipboard.writeText(text);
  showToast('📋 Đã copy transcript của bản ghi vào clipboard!');
}

// --- UTILS ---

function showToast(message) {
  toast.textContent = message;
  toast.className = 'toast show';
  setTimeout(() => {
    toast.className = 'toast';
  }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function escapeQuotes(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '\\"');
}
