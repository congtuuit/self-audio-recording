const fs = require('fs');
const path = require('path');

const LESSON_ID = 'REC_YT_6Af6b_wyiwI_20260725065439';
const metaPath = path.join(__dirname, 'recordings', LESSON_ID, 'meta.json');

// Group words into sentences based on punctuation and timestamp gaps (exact frontend logic)
const segmentSentences = (words) => {
  const result = [];
  let currentWords = [];
  let id = 1;

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    currentWords.push(w);

    const isEndPunctuation = /[.?!]$/.test(w.word.trim());
    const nextWord = words[i + 1];
    const isTimeGap = nextWord ? (nextWord.start - w.end > 1.2) : false;

    if (isEndPunctuation || isTimeGap || i === words.length - 1) {
      const sentenceText = currentWords.map(cw => cw.word).join(' ');
      result.push({
        id,
        text: sentenceText,
        start: currentWords[0].start,
        end: currentWords[currentWords.length - 1].end
      });
      id++;
      currentWords = [];
    }
  }
  return result;
};

async function test() {
  console.log(`[Test] Reading meta.json for ${LESSON_ID}...`);
  if (!fs.existsSync(metaPath)) {
    console.error(`Error: meta.json not found at ${metaPath}`);
    process.exit(1);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const words = meta.words || [];

  if (words.length === 0) {
    console.error('Error: No words found in meta.json to segment!');
    process.exit(1);
  }

  const sortedWords = [...words].sort((a, b) => a.start - b.start);
  const sentences = segmentSentences(sortedWords);
  const sentenceTexts = sentences.map(s => s.text);

  console.log(`[Test] Segmented into ${sentenceTexts.length} sentences.`);
  console.log(`[Test] First sentence: "${sentenceTexts[0]}"`);
  console.log(`[Test] Sending POST request to http://localhost:3000/api/analyze-lesson...`);

  const startTime = Date.now();
  try {
    const response = await fetch('http://localhost:3000/api/analyze-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: LESSON_ID,
        sentences: sentenceTexts
      })
    });

    const data = await response.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    if (response.ok) {
      console.log(`\n[SUCCESS] Request completed in ${duration}s!`);
      console.log(`[Result] totalProcessed: ${data.totalProcessed}`);
      console.log(`[Result] chunked: ${data.chunked}`);

      const analyzedCount = data.sentenceAnalysis?.sentences?.length || 0;
      console.log(`[Result] Total sentences in database: ${analyzedCount}`);

      if (data.newlyAnalyzed && data.newlyAnalyzed.sentences) {
        console.log(`[Result] Sample analyzed sentence:`, JSON.stringify(data.newlyAnalyzed.sentences[0], null, 2));
      }
    } else {
      console.error(`\n[FAILED] Request failed with status ${response.status} in ${duration}s!`);
      console.error('Error details:', data);
    }
  } catch (err) {
    console.error(`\n[ERROR] Network error:`, err.message);
  }
}

test();
