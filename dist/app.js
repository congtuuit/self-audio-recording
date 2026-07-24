// --- VOICE CRAFT STUDIO APP LOGIC (REFACTORED) ---

// ============================================
// DOM Elements
// ============================================
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

// Learning Workspace Elements
const learningWorkspace = document.getElementById('learningWorkspace');
const learningLessonTitle = document.getElementById('learningLessonTitle');
const learningTranscriptBox = document.getElementById('learningTranscriptBox');
const globalLearningAudio = document.getElementById('globalLearningAudio');
const btnCloseLearning = document.getElementById('btnCloseLearning');
const btnReTranscribe = document.getElementById('btnReTranscribe');
const btnCopyLearningText = document.getElementById('btnCopyLearningText');

// ============================================
// State Variables
// ============================================

// Recording State
let audioContext = null;
let activeStreams = [];
let audioSourceNode = null;
let analyserNode = null;
let scriptProcessorNode = null;
let pcmBuffers = [];
let recordingStartTime = 0;
let elapsedTime = 0;
let timerInterval = null;
let isRecording = false;
let isPaused = false;
let sampleRate = 44100;

// Web Speech Recognition State
let recognition = null;
let finalTranscript = '';
let interimTranscript = '';
let speechActive = false;
let isRecognitionRunning = false;
let isTestingSpeech = false;

// Learning Player State
let currentLessonRecId = null;
let currentLessonWords = [];
let isShadowingLoopActive = false;
let isUserHoveringTranscript = false;

// Polling State
let processingPollTimer = null;

// ============================================
// 1. INITIALIZATION
// ============================================

function setDefaultRecordingName() {
  const unixTimestamp = Math.floor(Date.now() / 1000);
  if (recordingNameInput) {
    recordingNameInput.value = `recording_${unixTimestamp}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setDefaultRecordingName();
  initSpeechRecognition();
  loadRecordingsLibrary();
  drawIdleVisualizer();

  btnStart.addEventListener('click', startRecording);
  btnPause.addEventListener('click', pauseRecording);
  btnResume.addEventListener('click', resumeRecording);
  btnStop.addEventListener('click', stopRecording);
  btnCopyTranscript.addEventListener('click', copyLiveTranscript);
  btnClearTranscript.addEventListener('click', clearLiveTranscript);
  btnRefreshLibrary.addEventListener('click', loadRecordingsLibrary);
  languageSelect.addEventListener('change', onLanguageChange);

  const btnTestSpeech = document.getElementById('btnTestSpeech');
  if (btnTestSpeech) {
    btnTestSpeech.addEventListener('click', toggleTestSpeech);
  }

  const btnUiLangToggle = document.getElementById('btnUiLangToggle');
  if (btnUiLangToggle) {
    btnUiLangToggle.addEventListener('click', () => {
      const nextLang = currentUiLang === 'en-US' ? 'vi-VN' : 'en-US';
      setUiLanguage(nextLang);
    });
  }

  // Learning Workspace Controls
  if (btnCloseLearning) {
    btnCloseLearning.addEventListener('click', closeLearningWorkspace);
  }
  if (btnReTranscribe) {
    btnReTranscribe.addEventListener('click', () => {
      if (currentLessonRecId) triggerTranscribe(currentLessonRecId);
    });
  }
  if (btnCopyLearningText) {
    btnCopyLearningText.addEventListener('click', copyLearningTranscript);
  }

  const speedSelect = document.getElementById('playbackSpeedSelect');
  if (speedSelect) {
    speedSelect.addEventListener('change', () => {
      if (globalLearningAudio) {
        globalLearningAudio.playbackRate = parseFloat(speedSelect.value);
        showToast(`⚡ Tốc độ phát: ${speedSelect.value}x`);
      }
    });
  }

  const btnLoop = document.getElementById('btnToggleLoop');
  if (btnLoop) {
    btnLoop.addEventListener('click', () => {
      isShadowingLoopActive = !isShadowingLoopActive;
      btnLoop.classList.toggle('active', isShadowingLoopActive);
      showToast(isShadowingLoopActive ? '🔂 Đã BẬT chế độ Lặp câu (Shadowing Loop)' : '⏹️ Đã TẮT chế độ Lặp câu');
    });
  }

  // Smart scroll: vô hiệu hóa auto-scroll khi người dùng hover vào hộp transcript
  if (learningTranscriptBox) {
    learningTranscriptBox.addEventListener('mouseenter', () => { isUserHoveringTranscript = true; });
    learningTranscriptBox.addEventListener('mouseleave', () => { isUserHoveringTranscript = false; });
  }
});

// ============================================
// 2. WEB SPEECH RECOGNITION (LIVE TRANSCRIPT)
// ============================================

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    speechStatus.textContent = '⚠️ Trình duyệt không hỗ trợ Web Speech API';
    speechStatus.style.color = '#ef4444';
    return;
  }

  try {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = languageSelect.value;

    recognition.onstart = () => {
      isRecognitionRunning = true;
      speechStatus.textContent = '🟢 Speech API: Đang lắng nghe...';
      speechStatus.style.color = '#10b981';
    };

    recognition.onresult = (event) => {
      interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      updateLiveTranscriptUI();
    };

    recognition.onerror = (event) => {
      isRecognitionRunning = false;
      if (event.error === 'not-allowed') {
        speechStatus.textContent = '❌ Chưa cấp quyền Micro';
        speechStatus.style.color = '#ef4444';
      } else if (event.error === 'network') {
        speechStatus.textContent = '❌ Lỗi mạng';
        speechStatus.style.color = '#ef4444';
      } else if (event.error === 'no-speech') {
        speechStatus.textContent = '🟡 Chờ giọng nói...';
        speechStatus.style.color = '#f59e0b';
      } else if (event.error === 'audio-capture') {
        speechStatus.textContent = '❌ Không tìm thấy Micro!';
        speechStatus.style.color = '#ef4444';
      } else {
        speechStatus.textContent = `⚠️ ${event.error}`;
        speechStatus.style.color = '#f59e0b';
      }
    };

    recognition.onend = () => {
      isRecognitionRunning = false;
      if ((speechActive || isTestingSpeech) && (isRecording || isTestingSpeech) && !isPaused) {
        setTimeout(() => {
          if ((speechActive || isTestingSpeech) && !isRecognitionRunning) {
            startSpeechRecognition();
          }
        }, 300);
      } else {
        speechStatus.textContent = '⚡ Speech API (Đã dừng)';
        speechStatus.style.color = '#9ca3af';
      }
    };

    speechStatus.textContent = '⚡ Web Speech API (Sẵn sàng)';
    speechStatus.style.color = '#10b981';
  } catch (err) {
    speechStatus.textContent = '❌ Không thể khởi tạo Speech Recognition';
    speechStatus.style.color = '#ef4444';
  }
}

function startSpeechRecognition() {
  if (!recognition) return;
  if (isRecognitionRunning) return;
  speechActive = true;
  recognition.lang = languageSelect.value;
  try { recognition.start(); } catch (e) {}
}

function stopSpeechRecognition() {
  speechActive = false;
  isTestingSpeech = false;
  if (recognition && isRecognitionRunning) {
    try { recognition.stop(); } catch (e) {}
  }
  isRecognitionRunning = false;
  speechStatus.textContent = '⚡ Speech API (Đã dừng)';
  speechStatus.style.color = '#9ca3af';
}

function toggleTestSpeech() {
  const btn = document.getElementById('btnTestSpeech');
  if (isTestingSpeech) {
    stopSpeechRecognition();
    if (btn) btn.textContent = '🧪 Thử Micro';
    showToast('Đã dừng thử nghiệm Speech API');
  } else {
    isTestingSpeech = true;
    startSpeechRecognition();
    if (btn) btn.textContent = '⏹️ Dừng thử';
    showToast('🧪 Đang thử nghiệm Speech Recognition...');
  }
}

function onLanguageChange() {
  if (recognition) {
    recognition.lang = languageSelect.value;
    showToast(`Đã đổi ngôn ngữ: ${languageSelect.options[languageSelect.selectedIndex].text}`);
    if (isRecognitionRunning) {
      stopSpeechRecognition();
      setTimeout(startSpeechRecognition, 400);
    }
  }
}

function updateLiveTranscriptUI() {
  if (!finalTranscript && !interimTranscript) {
    transcriptBox.innerHTML = '<p class="placeholder-text">Chữ thu âm trực tiếp sẽ hiển thị tại đây khi bạn nói...</p>';
    charCounter.textContent = '0 ký tự';
    return;
  }
  transcriptBox.innerHTML = `
    <span class="transcript-final">${escapeHtml(finalTranscript)}</span>
    <span class="transcript-interim">${escapeHtml(interimTranscript)}</span>
  `;
  transcriptBox.scrollTop = transcriptBox.scrollHeight;
  const totalLength = (finalTranscript + interimTranscript).length;
  charCounter.textContent = `${totalLength} ký tự`;
}

function copyLiveTranscript() {
  const fullText = (finalTranscript + ' ' + interimTranscript).trim();
  if (!fullText) { showToast('Không có nội dung transcript để copy!'); return; }
  navigator.clipboard.writeText(fullText);
  showToast('📋 Đã copy live transcript!');
}

function clearLiveTranscript() {
  finalTranscript = '';
  interimTranscript = '';
  updateLiveTranscriptUI();
  showToast('🗑️ Đã xóa live transcript');
}

// ============================================
// 3. AUDIO RECORDING ENGINE (PCM WAV)
// ============================================

async function startRecording() {
  const audioSourceMode = document.getElementById('audioSourceSelect').value;
  activeStreams = [];
  finalTranscript = '';
  interimTranscript = '';
  updateLiveTranscriptUI();
  startSpeechRecognition();

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  sampleRate = audioContext.sampleRate;
  let finalAudioStream = null;

  try {
    if (audioSourceMode === 'mic') {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreams.push(micStream);
      finalAudioStream = micStream;
    } else if (audioSourceMode === 'system') {
      showToast('ℹ️ Vui lòng chọn màn hình/thẻ và TÍCH VÀO "Chia sẻ âm thanh"!');
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      activeStreams.push(displayStream);
      const systemAudioTrack = displayStream.getAudioTracks()[0];
      if (!systemAudioTrack) throw new Error('Chưa tích chọn "Chia sẻ âm thanh hệ thống"!');
      displayStream.getVideoTracks().forEach(t => t.stop());
      finalAudioStream = new MediaStream([systemAudioTrack]);
    } else if (audioSourceMode === 'both') {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreams.push(micStream);
      showToast('ℹ️ Vui lòng chọn màn hình/thẻ và TÍCH VÀO "Chia sẻ âm thanh"!');
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      activeStreams.push(displayStream);
      const systemAudioTrack = displayStream.getAudioTracks()[0];
      if (!systemAudioTrack) throw new Error('Chưa tích chọn "Chia sẻ âm thanh hệ thống"!');
      displayStream.getVideoTracks().forEach(t => t.stop());
      const micSource = audioContext.createMediaStreamSource(micStream);
      const systemSource = audioContext.createMediaStreamSource(new MediaStream([systemAudioTrack]));
      const mixedDestination = audioContext.createMediaStreamDestination();
      micSource.connect(mixedDestination);
      systemSource.connect(mixedDestination);
      finalAudioStream = mixedDestination.stream;
    } else if (audioSourceMode === 'screen') {
      showToast('ℹ️ Vui lòng chọn màn hình/thẻ cần quay!');
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1920, height: 1080 }, audio: true });
      activeStreams.push(displayStream);
      const canvasEl = document.getElementById('visualizerCanvas');
      const videoEl = document.getElementById('videoPreview');
      if (canvasEl && videoEl) {
        canvasEl.style.display = 'none';
        videoEl.style.display = 'block';
        videoEl.srcObject = displayStream;
      }
      const systemAudioTrack = displayStream.getAudioTracks()[0];
      if (systemAudioTrack) {
        finalAudioStream = new MediaStream([systemAudioTrack]);
      } else {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        activeStreams.push(micStream);
        finalAudioStream = micStream;
      }
    }
  } catch (err) {
    showToast(`❌ Lỗi: ${err.message || 'Không thể truy cập nguồn âm thanh!'}`);
    activeStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
    if (audioContext) audioContext.close();
    return;
  }

  audioSourceNode = audioContext.createMediaStreamSource(finalAudioStream);
  analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 256;

  const bufferSize = 4096;
  scriptProcessorNode = audioContext.createScriptProcessor(bufferSize, 1, 1);
  pcmBuffers = [];
  scriptProcessorNode.onaudioprocess = (e) => {
    if (!isRecording || isPaused) return;
    const inputBuffer = e.inputBuffer.getChannelData(0);
    pcmBuffers.push(new Float32Array(inputBuffer));
  };

  audioSourceNode.connect(analyserNode);
  analyserNode.connect(scriptProcessorNode);
  scriptProcessorNode.connect(audioContext.destination);

  isRecording = true;
  isPaused = false;
  recordingStartTime = Date.now() - elapsedTime;
  startTimer();

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
  if (audioContext && audioContext.state === 'running') audioContext.suspend();
  btnPause.style.display = 'none';
  btnResume.style.display = 'inline-flex';
  statusBadge.className = 'status-badge paused';
  statusText.textContent = 'Đã tạm dừng';
  showToast('⏸️ Đã tạm dừng thu âm');
}

function resumeRecording() {
  if (!isRecording || !isPaused) return;
  isPaused = false;
  if (audioContext && audioContext.state === 'suspended') audioContext.resume();
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
  clearInterval(timerInterval);
  stopSpeechRecognition();
  activeStreams.forEach(stream => {
    if (stream) stream.getTracks().forEach(track => track.stop());
  });
  activeStreams = [];
  if (scriptProcessorNode) scriptProcessorNode.disconnect();
  if (analyserNode) analyserNode.disconnect();
  if (audioSourceNode) audioSourceNode.disconnect();
  if (audioContext) audioContext.close();

  btnStart.disabled = false;
  btnPause.disabled = true;
  btnPause.style.display = 'inline-flex';
  btnResume.style.display = 'none';
  btnStop.disabled = true;
  statusBadge.className = 'status-badge';
  statusText.textContent = 'Đang lưu file...';

  const wavBlob = encodeWAV(pcmBuffers, sampleRate);
  const fullTranscriptText = (finalTranscript + ' ' + interimTranscript).trim();
  const customName = recordingNameInput.value.trim();
  await saveRecordingToServer(wavBlob, fullTranscriptText, customName);

  elapsedTime = 0;
  timerDisplay.textContent = '00:00:00';
  statusBadge.className = 'status-badge';
  statusText.textContent = 'Sẵn sàng';
  setDefaultRecordingName();

  const canvasEl = document.getElementById('visualizerCanvas');
  const videoEl = document.getElementById('videoPreview');
  if (canvasEl && videoEl) {
    canvasEl.style.display = 'block';
    videoEl.style.display = 'none';
    videoEl.srcObject = null;
  }
  drawIdleVisualizer();
}

// ============================================
// 4. WAV PCM ENCODER (BROWSER NATIVE)
// ============================================

function encodeWAV(buffers, sampleRate) {
  let totalSamples = 0;
  for (let i = 0; i < buffers.length; i++) totalSamples += buffers[i].length;
  const mergedSamples = new Float32Array(totalSamples);
  let offset = 0;
  for (let i = 0; i < buffers.length; i++) {
    mergedSamples.set(buffers[i], offset);
    offset += buffers[i].length;
  }

  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, totalSamples * 2, true);

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

// ============================================
// 5. TIMER & VISUALIZER
// ============================================

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
  let x = 0;
  for (let i = 0; i < bufferLength; i++) {
    const barHeight = (dataArray[i] / 255) * canvas.height;
    const gradient = canvasCtx.createLinearGradient(0, canvas.height, 0, 0);
    gradient.addColorStop(0, '#6366f1');
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

// ============================================
// 6. SERVER API INTEGRATION
// ============================================

async function saveRecordingToServer(wavBlob, transcriptText, customName) {
  try {
    showToast('💾 Đang tải file lên server...');
    const reader = new FileReader();
    reader.readAsDataURL(wavBlob);

    reader.onloadend = async () => {
      const base64Audio = reader.result;
      const payload = {
        audioBase64: base64Audio,
        transcript: transcriptText,
        customName: customName,
        language: languageSelect.value
      };

      const response = await fetch('/api/save-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const resData = await response.json();

      if (resData.success) {
        showToast(`✅ Đã lưu: ${resData.recording.filename}`);
        loadRecordingsLibrary();

        // Bắt đầu polling nếu bản ghi đang xử lý transcript ngầm
        if (resData.recording.processing) {
          startProcessingPoll();
        }
      } else {
        showToast(`❌ Lỗi: ${resData.error}`);
      }
    };
  } catch (err) {
    showToast('❌ Lỗi kết nối server!');
  }
}

// ============================================
// 7. RECORDINGS LIBRARY (Thư viện bản ghi)
// ============================================

async function loadRecordingsLibrary() {
  try {
    recordingsList.innerHTML = '<div class="loading-spinner">Đang tải danh sách...</div>';
    const res = await fetch('/api/recordings');
    const data = await res.json();

    if (!data.success || data.recordings.length === 0) {
      recordingsList.innerHTML = '<p class="placeholder-text" style="padding: 1rem;">Chưa có bản ghi nào</p>';
      return;
    }

    let hasProcessing = false;
    recordingsList.innerHTML = '';

    data.recordings.forEach((rec) => {
      if (rec.processing) hasProcessing = true;

      const dateStr = new Date(rec.createdAt).toLocaleString('vi-VN');
      const sizeKB = (rec.size / 1024).toFixed(1);
      const item = document.createElement('div');
      item.className = 'recording-item' + (rec.processing ? ' processing' : '');

      const transcriptPreview = rec.processing
        ? '<div class="rec-processing-badge">⏳ Đang xử lý transcript AI...</div>'
        : (rec.transcript ? `<div class="rec-transcript-preview">📝 ${escapeHtml(rec.transcript.substring(0, 120))}${rec.transcript.length > 120 ? '...' : ''}</div>` : '');

      const learnBtnDisabled = rec.processing ? 'disabled style="opacity:0.4; cursor:not-allowed;"' : '';

      item.innerHTML = `
        <div class="rec-info">
          <div class="rec-title">🎵 ${escapeHtml(rec.filename)}</div>
          <div class="rec-meta">
            <span>📅 ${dateStr}</span>
            <span>💾 ${sizeKB} KB</span>
          </div>
        </div>
        ${transcriptPreview}
        <div class="rec-actions">
          <audio controls src="/recordings/${rec.filename}" preload="metadata"></audio>
          <button class="btn-sm btn-ghost btn-learn" data-recid="${rec.id}" data-filename="${rec.filename}" ${learnBtnDisabled}>🎓 Học bài này</button>
          <a href="/recordings/${rec.filename}" download="${rec.filename}" class="btn-sm btn-ghost">⬇️ .WAV</a>
          <button class="btn-sm btn-ghost btn-delete" data-recid="${rec.id}" style="color: #ef4444;">🗑️ Xóa</button>
        </div>
      `;
      recordingsList.appendChild(item);
    });

    // Gắn event listeners cho các nút trong danh sách
    document.querySelectorAll('.btn-learn').forEach(btn => {
      btn.addEventListener('click', () => {
        const recId = btn.dataset.recid;
        const filename = btn.dataset.filename;
        if (!btn.disabled) openLearningWorkspace(recId, filename);
      });
    });
    document.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => deleteRecording(btn.dataset.recid));
    });

    // Nếu có bản ghi đang xử lý, bắt đầu polling tự động
    if (hasProcessing) {
      startProcessingPoll();
    } else {
      stopProcessingPoll();
    }

  } catch (err) {
    recordingsList.innerHTML = '<p class="placeholder-text" style="color: #ef4444;">Không thể kết nối server.</p>';
  }
}

// ============================================
// 8. POLLING - Tự động cập nhật trạng thái transcript
// ============================================

function startProcessingPoll() {
  if (processingPollTimer) return; // Đã đang poll rồi
  processingPollTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/recordings');
      const data = await res.json();
      if (!data.success) return;

      const stillProcessing = data.recordings.some(r => r.processing);
      if (!stillProcessing) {
        stopProcessingPoll();
        loadRecordingsLibrary();
        showToast('✅ Transcript AI đã xử lý xong!');
      }
    } catch (e) {}
  }, 3000);
}

function stopProcessingPoll() {
  if (processingPollTimer) {
    clearInterval(processingPollTimer);
    processingPollTimer = null;
  }
}

// ============================================
// 9. FOCUS LEARNING WORKSPACE
// ============================================

async function openLearningWorkspace(recId, filename) {
  currentLessonRecId = recId;

  // Hiển thị workspace
  learningWorkspace.style.display = 'block';
  learningLessonTitle.textContent = `Bài học: ${filename}`;

  // Set audio source
  globalLearningAudio.src = `/recordings/${filename}`;
  globalLearningAudio.load();

  const speedSelect = document.getElementById('playbackSpeedSelect');
  if (speedSelect) globalLearningAudio.playbackRate = parseFloat(speedSelect.value);

  showToast(`🎓 Đang tải bài học [${recId}]...`);

  // Lấy dữ liệu timestamps
  try {
    const res = await fetch('/api/recordings');
    const data = await res.json();
    const targetRec = data.recordings.find(r => r.id === recId);

    if (!targetRec || !targetRec.words || targetRec.words.length === 0) {
      showToast('⚠️ Bài học chưa có mốc thời gian. Đang tự động phân tích...');
      await triggerTranscribe(recId);
      // Reload sau khi transcribe xong
      setTimeout(() => openLearningWorkspace(recId, filename), 2000);
      return;
    }

    currentLessonWords = targetRec.words;
    renderInteractiveWords(currentLessonWords);

    // Gắn sự kiện timeupdate cho Karaoke sync
    globalLearningAudio.ontimeupdate = () => {
      syncKaraokeHighlight(globalLearningAudio.currentTime);
    };

    globalLearningAudio.play();
    showToast('▶️ Đang phát! Bấm vào từ bất kỳ để nghe lại.');

    // Cuộn trang mượt mà đến workspace
    learningWorkspace.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    showToast('❌ Lỗi tải bài học');
  }
}

function closeLearningWorkspace() {
  currentLessonRecId = null;
  currentLessonWords = [];
  globalLearningAudio.pause();
  globalLearningAudio.src = '';
  globalLearningAudio.ontimeupdate = null;
  learningWorkspace.style.display = 'none';
  learningTranscriptBox.innerHTML = '<p class="placeholder-text">Văn bản Karaoke đồng bộ sẽ xuất hiện tại đây khi bạn chọn bài học...</p>';
  showToast('📕 Đã đóng bài học');
}

function renderInteractiveWords(words) {
  if (!words || words.length === 0) return;
  learningTranscriptBox.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'interactive-transcript-container';

  words.forEach((w) => {
    const span = document.createElement('span');
    span.className = 'interactive-word';
    span.dataset.start = w.start;
    span.dataset.end = w.end;
    span.dataset.word = w.word;
    span.textContent = w.word + ' ';

    // Click-to-seek
    span.addEventListener('click', (e) => {
      e.stopPropagation();
      seekToWord(parseFloat(w.start));
    });

    // Double-click: tra từ điển
    span.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      lookupDictionaryWord(w.word);
    });

    container.appendChild(span);
  });

  learningTranscriptBox.appendChild(container);
}

function syncKaraokeHighlight(currentTime) {
  const wordSpans = learningTranscriptBox.querySelectorAll('.interactive-word');
  let currentActiveWord = null;

  wordSpans.forEach(span => {
    const start = parseFloat(span.dataset.start);
    const end = parseFloat(span.dataset.end);

    if (currentTime >= start && currentTime <= end) {
      span.classList.add('active-word');
      currentActiveWord = span;
    } else {
      span.classList.remove('active-word');
    }
  });

  if (currentActiveWord) {
    // Smart scroll: chỉ cuộn hộp transcript (không cuộn trang) và chỉ khi từ nằm ngoài viewport của hộp
    if (!isUserHoveringTranscript) {
      const boxRect = learningTranscriptBox.getBoundingClientRect();
      const wordRect = currentActiveWord.getBoundingClientRect();

      // Kiểm tra xem từ có nằm ngoài vùng nhìn thấy của hộp không
      const isAbove = wordRect.top < boxRect.top;
      const isBelow = wordRect.bottom > boxRect.bottom;

      if (isAbove || isBelow) {
        // Cuộn container hộp chữ thay vì cuộn trang
        const scrollOffset = currentActiveWord.offsetTop - learningTranscriptBox.offsetTop - (learningTranscriptBox.clientHeight / 3);
        learningTranscriptBox.scrollTo({ top: scrollOffset, behavior: 'auto' });
      }
    }

    // Handle Shadowing A-B loop
    if (isShadowingLoopActive && globalLearningAudio) {
      const activeEnd = parseFloat(currentActiveWord.dataset.end);
      if (currentTime >= activeEnd - 0.05) {
        globalLearningAudio.currentTime = parseFloat(currentActiveWord.dataset.start);
      }
    }
  }
}

function seekToWord(startTime) {
  if (globalLearningAudio) {
    globalLearningAudio.currentTime = startTime;
    globalLearningAudio.play();
  }
}

function copyLearningTranscript() {
  if (!currentLessonWords || currentLessonWords.length === 0) {
    showToast('Không có nội dung để copy!');
    return;
  }
  const fullText = currentLessonWords.map(w => w.word).join(' ');
  navigator.clipboard.writeText(fullText);
  showToast('📋 Đã copy toàn bộ văn bản bài học!');
}

async function lookupDictionaryWord(word) {
  const cleanWord = word.replace(/[^a-zA-Z]/g, '').toLowerCase();
  if (!cleanWord) return;
  showToast(`📖 Đang tra từ điển: "${cleanWord}"...`);
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      const entry = data[0];
      const phonetic = entry.phonetic || (entry.phonetics.find(p => p.text) || {}).text || '';
      const meaning = (entry.meanings[0] && entry.meanings[0].definitions[0]) ? entry.meanings[0].definitions[0].definition : '';
      showToast(`📖 [${cleanWord}] ${phonetic}: ${meaning.slice(0, 80)}...`);
    } else {
      showToast(`📖 Không tìm thấy: "${cleanWord}"`);
    }
  } catch (err) {
    showToast(`📖 Lỗi tra từ điển "${cleanWord}"`);
  }
}

// ============================================
// 10. TRANSCRIPT & DELETE ACTIONS
// ============================================

async function triggerTranscribe(id) {
  try {
    showToast(`🤖 Đang phân tích file [${id}]...`);
    const lang = languageSelect.value;
    const res = await fetch(`/api/transcribe/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: lang })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ Transcript đã hoàn thành cho [${id}]!`);
      loadRecordingsLibrary();
    } else {
      showToast(`❌ Lỗi: ${data.error}`);
    }
  } catch (err) {
    showToast('❌ Lỗi gửi yêu cầu phân tích transcript');
  }
}

async function deleteRecording(id) {
  if (!confirm(`Bạn có chắc muốn xóa bản ghi [${id}]?`)) return;
  try {
    const res = await fetch(`/api/recordings/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('🗑️ Đã xóa bản ghi');
      // Nếu đang học bài bị xóa, đóng workspace
      if (currentLessonRecId === id) closeLearningWorkspace();
      loadRecordingsLibrary();
    } else {
      showToast(`❌ Xóa thất bại: ${data.error}`);
    }
  } catch (err) {
    showToast('❌ Lỗi khi xóa bản ghi');
  }
}

// ============================================
// UTILS
// ============================================

function showToast(message) {
  toast.textContent = message;
  toast.className = 'toast show';
  setTimeout(() => { toast.className = 'toast'; }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
