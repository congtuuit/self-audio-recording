// --- i18n DUAL LANGUAGE ENGINE (vi-VN & en-US) ---

const TRANSLATIONS = {
  'vi-VN': {
    brandSubtitle: 'Studio Thu âm, Quay màn hình & Học tiếng Anh tương tác',
    statusReady: 'Sẵn sàng',
    statusRecording: 'Đang thu âm...',
    statusPaused: 'Đã tạm dừng',
    statusSaving: 'Đang lưu file...',
    headerRecorder: '🎙️ Thu âm & Quay màn hình',
    labelAudioSource: 'Nguồn thu:',
    optSourceSystem: '🔊 Chỉ Âm thanh hệ thống (Loa/Máy tính)',
    optSourceMic: '🎙️ Chỉ Micro (Giọng nói)',
    optSourceBoth: '🎙️+🔊 Cả Micro & Hệ thống (Hỗn hợp)',
    optSourceScreen: '📹 Quay màn hình HD + Âm thanh',
    labelRecordingName: 'Tên bản ghi:',
    labelTranscriptLang: 'Ngôn ngữ Transcript:',
    btnStart: '🔴 Bắt đầu Thu âm',
    btnPause: '⏸️ Tạm dừng',
    btnResume: '⏯️ Tiếp tục',
    btnStop: '⏹️ Dừng & Lưu (.WAV + .TXT)',
    headerTranscript: '📝 Transcript & Học tương tác',
    btnTestSpeech: '🧪 Thử Micro Speech',
    btnCopy: '📋 Copy',
    btnClear: '🗑️ Xóa',
    placeholderTranscript: 'Văn bản chuyển đổi từ giọng nói sẽ hiển thị tại đây khi bạn thu âm hoặc xem lại bản ghi...',
    speechActive: '⚡ Web Speech API (Đã sẵn sàng)',
    headerLibrary: '📁 Danh sách các bản ghi & Bài học đã lưu',
    btnRefresh: '🔄 Làm mới danh sách',
    lblSpeed: 'Tốc độ:',
    lblLoop: '🔂 Lặp câu (Shadowing)',
    btnAiTranscribe: '🤖 AI Transcribe',
    btnDelete: '🗑️ Xóa',
    confirmDelete: 'Bạn có chắc chắn muốn xóa bản ghi này không?',
    headerLiveTranscript: '📝 Live Transcript (Thu âm trực tiếp)',
    placeholderLiveTranscript: 'Chữ thu âm trực tiếp sẽ hiển thị tại đây khi bạn nói...',
    headerLearningWorkspace: '🎓 Không gian học Tiếng Anh tương tác',
    btnCloseLearning: '❌ Đóng bài học'
  },
  'en-US': {
    brandSubtitle: 'Screen & Audio Studio with Interactive English Learning',
    statusReady: 'Ready',
    statusRecording: 'Recording...',
    statusPaused: 'Paused',
    statusSaving: 'Saving file...',
    headerRecorder: '🎙️ Audio & Screen Recorder',
    labelAudioSource: 'Input Source:',
    optSourceSystem: '🔊 System Audio Only (Speaker/PC)',
    optSourceMic: '🎙️ Microphone Only (Voice)',
    optSourceBoth: '🎙️+🔊 Mic & System Audio (Mixed)',
    optSourceScreen: '📹 HD Screen Recording + Audio',
    labelRecordingName: 'Recording Title:',
    labelTranscriptLang: 'Transcript Language:',
    btnStart: '🔴 Start Recording',
    btnPause: '⏸️ Pause',
    btnResume: '⏯️ Resume',
    btnStop: '⏹️ Stop & Save (.WAV + .TXT)',
    headerTranscript: '📝 Interactive Transcript & Learning',
    btnTestSpeech: '🧪 Test Mic Speech',
    btnCopy: '📋 Copy',
    btnClear: '🗑️ Clear',
    placeholderTranscript: 'Speech-to-text transcript will appear here during live recording or playback...',
    speechActive: '⚡ Web Speech API (Ready)',
    headerLibrary: '📁 Saved Recordings & Lessons Library',
    btnRefresh: '🔄 Refresh Library',
    lblSpeed: 'Speed:',
    lblLoop: '🔂 Shadowing Loop',
    btnAiTranscribe: '🤖 AI Transcribe',
    btnDelete: '🗑️ Delete',
    confirmDelete: 'Are you sure you want to delete this recording?',
    headerLiveTranscript: '📝 Live Transcript (Real-time)',
    placeholderLiveTranscript: 'Real-time transcript will appear here when you speak...',
    headerLearningWorkspace: '🎓 Interactive English Learning Workspace',
    btnCloseLearning: '❌ Close Lesson'
  }
};

let currentUiLang = localStorage.getItem('voicecraft_ui_lang') || 'en-US';

function t(key) {
  const dict = TRANSLATIONS[currentUiLang] || TRANSLATIONS['en-US'];
  return dict[key] || key;
}

function setUiLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentUiLang = lang;
  localStorage.setItem('voicecraft_ui_lang', lang);

  // Update text elements with data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (TRANSLATIONS[lang][key]) {
      el.textContent = TRANSLATIONS[lang][key];
    }
  });

  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (TRANSLATIONS[lang][key]) {
      el.placeholder = TRANSLATIONS[lang][key];
    }
  });

  // Update UI Language Toggle Button
  const btnToggle = document.getElementById('btnUiLangToggle');
  if (btnToggle) {
    btnToggle.textContent = lang === 'en-US' ? '🌐 English' : '🌐 Tiếng Việt';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setUiLanguage(currentUiLang);
});
