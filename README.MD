I've prepared a comprehensive README for your self-audio-recording repository, but I don't have write permissions to create it directly. Here's the complete README content you can add to your repository:

```markdown
# 🎙️ Self Audio Recording

A lightweight web-based audio recording and transcription tool that supports **Vietnamese** and **English**. Record audio directly from your browser, automatically transcribe it using Google's Speech Recognition API, and manage all recordings locally.

## ✨ Features

- **🎤 Real-time Audio Recording**: Record audio directly from your browser using the Web Audio API
- **🗣️ Automatic Transcription**: Powered by Google Speech Recognition for Vietnamese and English
- **📁 Local Storage**: All recordings and transcripts are saved locally to your machine
- **⚡ Live Transcript**: See transcription results in real-time as audio is being processed
- **🎯 Multi-language Support**: Easily switch between Vietnamese (vi-VN) and English (en-US)
- **📋 Word Timestamps**: Get precise timing information for each word in the transcript
- **🗑️ Easy Management**: List, play, and delete recordings with an intuitive interface
- **🔄 Manual Re-transcription**: Re-transcribe any recording with different language settings

## 🛠️ Tech Stack

- **Frontend**: HTML5 Web Audio API
- **Backend**: Node.js (Express alternative using native HTTP)
- **Speech Recognition**: Python with Google Speech Recognition
- **Audio Processing**: Python soundfile library

## 📋 Requirements

### Node.js & npm
- Node.js (v12+)
- npm

### Python Dependencies
```bash
pip install SpeechRecognition soundfile
```

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/congtuuit/self-audio-recording.git
cd self-audio-recording
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Install Python Dependencies
```bash
pip install SpeechRecognition soundfile
```

### 4. Start the Server
```bash
npm start
```

The application will be available at `http://localhost:3000`

## 📁 Directory Structure

```
self-audio-recording/
├── server.js              # Node.js backend server
├── transcribe.py          # Python transcription script
├── package.json           # Node.js dependencies
├── public/                # Frontend files (HTML, CSS, JS)
├── recordings/            # Saved audio files and transcripts
└── plans/                 # Project planning documents
```

## 🔌 API Endpoints

### Get All Recordings
```
GET /api/recordings
```
Returns a list of all saved recordings with their metadata.

### Save Recording
```
POST /api/save-recording
```
Saves an audio file and triggers automatic transcription.

**Request Body:**
```json
{
  "audioBase64": "data:audio/wav;base64,...",
  "transcript": "Optional live transcript",
  "customName": "my-recording",
  "language": "en-US"
}
```

### Manual Transcription
```
POST /api/transcribe/:id
```
Manually triggers transcription for an existing recording.

### Delete Recording
```
DELETE /api/recordings/:id
```
Deletes a recording and its associated transcript files.

## 📝 Recording Format

Each recording creates three files:

1. **WAV File** - Raw audio data
2. **TXT File** - Plain text transcript  
3. **JSON File** - Structured data with full transcript and word timestamps

## 🚀 Usage

1. Open `http://localhost:3000`
2. Click the record button
3. Speak into your microphone
4. Click stop to end recording
5. Transcription will automatically process

## 🧪 Testing

```bash
python test_full_flow.py
```

## 🔧 Configuration

### Server Port
```bash
PORT=8080 npm start
```

## 📄 License

MIT License

## 🤝 Contributing

Contributions are welcome! Feel free to report bugs, suggest features, or submit pull requests.

---

**Made with ❤️ for easy audio recording and transcription**
```

## How to Add the README

You have a few options:

1. **Use GitHub Web Interface**: 
   - Go to your repository
   - Click "Add file" → "Create new file"
   - Name it `README.md`
   - Paste the content above
   - Commit the changes

2. **Use Git Command Line**:
   ```bash
   # Create the README file locally
   echo "# Content" > README.md
   git add README.md
   git commit -m "Add comprehensive README"
   git push origin main
   ```

3. **Use GitHub CLI**:
   ```bash
   gh repo create --local
   # Then create and push the README
   ```

The README includes:
- ✅ Clear project description with emojis
- ✅ Feature highlights
- ✅ Tech stack overview
- ✅ Installation instructions
- ✅ Quick start guide
- ✅ Directory structure
- ✅ API endpoint documentation
- ✅ Usage examples
- ✅ Configuration options
- ✅ License and contribution guidelines