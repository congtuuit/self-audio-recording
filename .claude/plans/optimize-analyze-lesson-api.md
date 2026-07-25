# Plan: Optimize /api/analyze-lesson and Implement One-Time Full-Lesson Translation

## Summary
Optimize the `/api/analyze-lesson` API endpoint to translate all sentences in a lesson at once when the user opens it, instead of making real-time API calls for each sentence during learning. Display translations in the "🇻🇳 Translation" block of the AI Study Coach Panel.

## Current Issues
1. **Real-time sentence-by-sentence API calls**: The frontend calls `/api/analyze-lesson` for each sentence as it becomes active during learning (lines 423-480 in `components/ShadowingWorkspace/index.tsx`). This is slow and expensive.
2. **Missing `sentenceAnalysis` in recordings list**: `GET /api/recordings` doesn't return `sentenceAnalysis` from `meta.json`, so `lesson.sentenceAnalysis` is always `undefined` on load.
3. **No duplicate prevention**: Line 44 of `app/api/analyze-lesson/route.ts` pushes sentences without checking for duplicates (Code Review Issue #9).
4. **No batch analysis support**: The API doesn't support analyzing multiple sentences in a single request.

## User Requirements
- Call translation API **once** for the full lesson (all clauses) when user clicks on the lesson
- Do **NOT** call in real-time while learning
- Update `meta.json` with translations if not present
- Show translations in the "🇻🇳 Translation" block

## Implementation Plan

### 1. Backend: Add `sentenceAnalysis` to GET /api/recordings
**File**: `app/api/recordings/route.ts`
**Lines**: 39-82

**Change**: Add `sentenceAnalysis` field when reading `meta.json`:
```typescript
if (hasMeta) {
  try {
    const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    transcript = metaData.fullText || '';
    words = metaData.words || [];
    duration = metaData.duration || 0;
    language = metaData.language || 'en-US';
    if (metaData.createdAt) createdAt = new Date(metaData.createdAt);
    aiScore = metaData.aiScore;
    dictionary = metaData.dictionary || {};
    sentenceAnalysis = metaData.sentenceAnalysis || { sentences: [] };  // ADD THIS
    // ... rest of fields
```

And include it in the returned recording object:
```typescript
recordings.push({
  id: item,
  filename: `${item}/audio.wav`,
  // ... other fields
  sentenceAnalysis: sentenceAnalysis,  // ADD THIS
  duration: duration
});
```

**Benefit**: Frontend will receive `lesson.sentenceAnalysis` immediately, avoiding unnecessary API calls if analysis already exists.

---

### 2. Backend: Support batch sentence analysis in /api/analyze-lesson
**File**: `app/api/analyze-lesson/route.ts`

**Changes**:

#### 2a. Accept `sentences` array parameter
**Lines**: 10-11

Add `sentences` to destructured request body:
```typescript
const { id, apiKey, modelName, customUrl, provider, sentence, sentences } = body;
```

#### 2b. Handle batch analysis logic
**Lines**: 26-50

Replace the current logic with:
```typescript
// If no specific sentence/sentences requested, and full analysis exists, return it
if (!sentence && (!sentences || sentences.length === 0) && meta.sentenceAnalysis && meta.sentenceAnalysis.sentences && meta.sentenceAnalysis.sentences.length > 0) {
  return NextResponse.json({ sentenceAnalysis: meta.sentenceAnalysis });
}

const fullText = meta.fullText || meta.transcript || '';
if (!fullText.trim()) {
  return NextResponse.json({ error: 'No transcript to analyze' }, { status: 400 });
}

let textToAnalyze: string | string[];
let analysisMode: 'single-sentence' | 'batch-sentences' | 'full-text';

if (sentence) {
  // Single sentence analysis (backward compatibility)
  textToAnalyze = sentence;
  analysisMode = 'single-sentence';
} else if (sentences && Array.isArray(sentences) && sentences.length > 0) {
  // Batch analysis: filter out sentences that are already analyzed
  const existingSentences = meta.sentenceAnalysis?.sentences || [];
  const missingS sentences = sentences.filter(s => {
    const cleanS = s.toLowerCase().trim();
    return !existingSentences.some((existing: any) => {
      const cleanExisting = (existing.english || '').toLowerCase().trim();
      return cleanExisting && (cleanS.startsWith(cleanExisting.substring(0, 20)) || cleanExisting.startsWith(cleanS.substring(0, 20)));
    });
  });
  
  if (missingSentences.length === 0) {
    // All sentences already analyzed
    return NextResponse.json({ sentenceAnalysis: meta.sentenceAnalysis });
  }
  
  textToAnalyze = missingSentences;
  analysisMode = 'batch-sentences';
} else {
  // Full text analysis (fallback)
  textToAnalyze = fullText;
  analysisMode = 'full-text';
}

const analysis = await generateSentenceAnalysisWithAI(textToAnalyze, apiKey, modelName, customUrl, provider);

// Validate that analysis contains valid sentences before saving
if (!analysis || !analysis.sentences || !Array.isArray(analysis.sentences) || analysis.sentences.length === 0) {
  logger.error('AI returned empty or invalid analysis');
  return NextResponse.json({ 
    error: 'AI analysis failed or returned no results',
    sentenceAnalysis: meta.sentenceAnalysis || { sentences: [] }
  }, { status: 500 });
}

// Save back to meta.json with duplicate prevention
if (!meta.sentenceAnalysis) meta.sentenceAnalysis = { sentences: [] };
if (!meta.sentenceAnalysis.sentences) meta.sentenceAnalysis.sentences = [];

for (const newSentence of analysis.sentences) {
  const cleanNew = (newSentence.english || '').toLowerCase().trim();
  if (!cleanNew) continue;
  
  const existingIdx = meta.sentenceAnalysis.sentences.findIndex((s: any) => {
    const cleanExisting = (s.english || '').toLowerCase().trim();
    return cleanExisting === cleanNew;
  });
  
  if (existingIdx !== -1) {
    // Update existing analysis
    meta.sentenceAnalysis.sentences[existingIdx] = newSentence;
  } else {
    // Add new analysis
    meta.sentenceAnalysis.sentences.push(newSentence);
  }
}

fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');

return NextResponse.json({ sentenceAnalysis: meta.sentenceAnalysis, newlyAnalyzed: analysis });
```

**Benefits**:
- Supports batch analysis of multiple sentences
- Filters out already-analyzed sentences (huge performance win!)
- Prevents duplicates using exact lowercase matching
- Validates AI response before saving
- Returns early if all sentences are already analyzed

---

### 3. Backend: Modify generateSentenceAnalysisWithAI to support batch
**File**: `app/api/helper.ts`
**Function**: `generateSentenceAnalysisWithAI`
**Lines**: 235-340

#### 3a. Update function signature
**Line**: 235

```typescript
export async function generateSentenceAnalysisWithAI(
  textOrSentences: string | string[],  // Changed from `fullText: string`
  apiKey: string,
  modelName: string = 'gpt-4o-mini',
  customUrl?: string,
  provider: string = 'auto'
): Promise<any> {
```

#### 3b. Add input validation
**Line**: 242

```typescript
if (!textOrSentences || (Array.isArray(textOrSentences) && textOrSentences.length === 0)) {
  return {};
}
```

#### 3c. Create conditional prompt
**Lines**: 254-273

Replace the single prompt with conditional logic:
```typescript
let prompt = '';
if (Array.isArray(textOrSentences)) {
  // Batch sentences prompt
  prompt = `Bạn là một chuyên gia ngôn ngữ tiếng Anh. Hãy dịch nghĩa và phân tích các câu tiếng Anh sau đây sang tiếng Việt.

Danh sách các câu cần dịch và phân tích:
${textOrSentences.map((s, i) => `${i + 1}. "${s}"`).join('\n')}

Yêu cầu:
1. Phân tích từng câu trong danh sách và xuất ra JSON duy nhất theo schema sau.
2. Trường "english" trong kết quả trả về phải giữ nguyên câu gốc từ danh sách (hoặc viết thường).
LƯU Ý: Phải là định dạng JSON hợp lệ.
Schema:
{
  "sentences": [
    {
      "english": "câu tiếng anh gốc",
      "translation": "Bản dịch nghĩa tiếng Việt tự nhiên",
      "grammar": "Phân tích cấu trúc ngữ pháp chính hoặc điểm đáng chú ý trong câu (1-2 câu)",
      "linkings": ["Quy tắc nối âm 1 (vd: want you -> /wɑːn-tʃuː/)", "Quy tắc nối âm 2"],
      "shadowing": "Mẹo nhấn nhá, ngắt nghỉ, lên xuống giọng cho câu này"
    }
  ]
}`;
} else {
  // Original full-text prompt (unchanged)
  prompt = `Bạn là một chuyên gia ngôn ngữ tiếng Anh. Hãy phân tích từng câu trong đoạn transcript sau đây.
Transcript: "${textOrSentences}"

Yêu cầu: 
1. Tách đoạn văn thành các câu riêng biệt (dựa trên dấu chấm, dấu hỏi).
2. Phân tích và xuất ra JSON duy nhất theo schema sau. 
LƯU Ý: Phải là định dạng JSON hợp lệ.
Schema:
{
  "sentences": [
    {
      "english": "câu tiếng anh gốc (viết thường, giữ nguyên nguyên văn)",
      "translation": "Bản dịch nghĩa tiếng Việt tự nhiên",
      "grammar": "Phân tích cấu trúc ngữ pháp chính hoặc điểm đáng chú ý trong câu (1-2 câu)",
      "linkings": ["Quy tắc nối âm 1 (vd: want you -> /wɑːn-tʃuː/)", "Quy tắc nối âm 2"],
      "shadowing": "Mẹo nhấn nhá, ngắt nghỉ, lên xuống giọng cho câu này"
    }
  ]
}`;
}
```

**Benefits**:
- Single function handles both batch and single-text analysis
- Batch prompt is optimized for translating a list of sentences
- Maintains backward compatibility with full-text analysis

---

### 4. Frontend: Remove real-time sentence analysis
**File**: `components/ShadowingWorkspace/index.tsx`
**Lines**: 423-480

**Action**: **DELETE** this entire `useEffect` block that calls `/api/analyze-lesson` for `currentSentence`.

**Why**: We're replacing it with a one-time full-lesson analysis on load.

---

### 5. Frontend: Add one-time full-lesson analysis on load
**File**: `components/ShadowingWorkspace/index.tsx`
**Location**: After line 389 (after the lesson audio loading `useEffect`)

**Add**:
```typescript
// Sync sentenceAnalysis state when lesson changes
useEffect(() => {
  setSentenceAnalysis(lesson.sentenceAnalysis || { sentences: [] });
}, [lesson.id, lesson.sentenceAnalysis]);

// One-time full-lesson analysis on load (if not already analyzed)
useEffect(() => {
  // If we already have analyzed sentences, don't re-fetch
  if (sentenceAnalysis.sentences && sentenceAnalysis.sentences.length > 0) {
    return;
  }

  // Wait for sentences to be computed
  if (sentences.length === 0) return;

  const triggerFullLessonAnalysis = async () => {
    setIsAnalyzingSentences(true);
    try {
      const stored = localStorage.getItem('voicecraft_settings');
      let apiKey = '';
      let modelName = '';
      let customUrl = '';
      let provider = 'auto';

      if (stored) {
        const parsed = JSON.parse(stored);
        provider = parsed.providerPreference || 'auto';
        customUrl = parsed.customEndpointUrl || '';
        if (provider === 'gemini') {
          apiKey = parsed.geminiKey || '';
          modelName = parsed.geminiModel || '';
        } else if (provider === 'custom') {
          apiKey = parsed.customEndpointKey || '';
          modelName = parsed.customEndpointModel || '';
        } else {
          apiKey = parsed.openaiKey || parsed.whisperKey || '';
          modelName = parsed.openaiModel || 'gpt-4o-mini';
        }
      }

      // Call API with full list of sentence texts
      const res = await fetch('/api/analyze-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: lesson.id,
          apiKey,
          modelName,
          customUrl,
          provider,
          sentences: sentences.map(s => s.text)
        })
      });
      
      const data = await res.json();
      if (data.sentenceAnalysis) {
        setSentenceAnalysis(data.sentenceAnalysis);
      }
    } catch (err) {
      console.error('Error fetching full lesson analysis:', err);
    } finally {
      setIsAnalyzingSentences(false);
    }
  };

  triggerFullLessonAnalysis();
}, [lesson.id, sentences]);
```

**Benefits**:
- Calls API only once when lesson loads
- Passes all sentence texts to backend for batch analysis
- Backend filters out already-analyzed sentences (performance!)
- Does not run during learning (no real-time calls)
- Syncs `sentenceAnalysis` state when lesson changes

---

### 6. Type Updates
**File**: `types/index.ts`
**Lines**: 51

Verify that `sentenceAnalysis` type is correct:
```typescript
sentenceAnalysis?: {
  sentences: Array<{
    english: string;
    translation: string;
    grammar: string;
    linkings: string[];
    shadowing: string;
  }>;
};
```

---

## Performance Optimizations Summary

1. **Early return if already analyzed**: Both frontend and backend check if analysis exists before making AI calls
2. **Filter missing sentences**: Backend only analyzes sentences that don't have translations yet
3. **Batch analysis**: Multiple sentences analyzed in one AI request instead of N separate requests
4. **Duplicate prevention**: Exact lowercase matching prevents duplicate entries in `meta.json`
5. **Validation before save**: Don't save empty or invalid AI responses
6. **Include in recordings list**: Frontend gets `sentenceAnalysis` immediately without extra API call

## Testing Checklist

- [ ] Open a lesson without `sentenceAnalysis` → API is called once, translations appear
- [ ] Open a lesson with `sentenceAnalysis` → No API call, translations appear immediately
- [ ] Open a lesson with partial `sentenceAnalysis` → API analyzes only missing sentences
- [ ] Switch between lessons → Analysis state updates correctly
- [ ] AI returns invalid JSON → Error handled gracefully, doesn't corrupt `meta.json`
- [ ] Multiple users analyze same lesson → No race conditions, duplicates prevented
- [ ] Long transcript (50+ sentences) → Batch analysis completes successfully
- [ ] Custom LLM provider (e.g. LM Studio) → Works with `customUrl` parameter

## Files to Modify

1. `app/api/recordings/route.ts` - Add `sentenceAnalysis` to response
2. `app/api/analyze-lesson/route.ts` - Support batch analysis, add duplicate prevention
3. `app/api/helper.ts` - Modify `generateSentenceAnalysisWithAI` to accept `string | string[]`
4. `components/ShadowingWorkspace/index.tsx` - Remove real-time calls, add one-time analysis
5. `types/index.ts` - Verify `sentenceAnalysis` type (likely no changes needed)

## Estimated Impact

- **API calls reduced**: From N (number of sentences) to 1 per lesson
- **Token usage reduced**: Filter missing sentences → only translate what's needed
- **User experience**: Instant translations if already analyzed, one background load if not
- **Code quality**: Fixes Code Review Issue #9 (duplicate prevention)
