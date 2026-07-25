import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { generateSentenceAnalysisWithAI, RECORDINGS_DIR } from '../helper';
import { logger } from '../logger';
import { getAIConfig } from '../config';

// Track currently active analysis jobs
const activeJobs = new Set<string>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, apiKey: reqApiKey, modelName: reqModelName, customUrl: reqCustomUrl, provider: reqProvider, sentence, sentences } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing lesson id' }, { status: 400 });
    }

    const { apiKey, modelName, customUrl, provider } = getAIConfig(reqApiKey, reqModelName, reqCustomUrl, reqProvider);

    const folderPath = path.join(RECORDINGS_DIR, id);
    const metaPath = path.join(folderPath, 'meta.json');

    if (!fs.existsSync(metaPath)) {
      return NextResponse.json({ error: 'Lesson meta not found' }, { status: 404 });
    }

    const metaRaw = fs.readFileSync(metaPath, 'utf8');
    const meta = JSON.parse(metaRaw);

    const fullText = meta.fullText || meta.transcript || '';

    // 1. Check if we already have the analysis for the requested input
    let isFullyAnalyzed = false;
    let missingSentences: string[] = [];

    if (sentence) {
      // Single sentence case
      const existingSentences = meta.sentenceAnalysis?.sentences || [];
      const cleanS = sentence.toLowerCase().trim();
      const alreadyAnalyzed = existingSentences.some((existing: any) => {
        const cleanExisting = (existing.english || '').toLowerCase().trim();
        return cleanExisting === cleanS;
      });
      if (alreadyAnalyzed) {
        isFullyAnalyzed = true;
      } else {
        missingSentences = [sentence];
      }
    } else if (sentences && Array.isArray(sentences) && sentences.length > 0) {
      // Batch sentences case
      const existingSentences = meta.sentenceAnalysis?.sentences || [];
      missingSentences = sentences.filter(s => {
        const cleanS = s.toLowerCase().trim();
        return !existingSentences.some((existing: any) => {
          const cleanExisting = (existing.english || '').toLowerCase().trim();
          return cleanExisting && (cleanS.startsWith(cleanExisting.substring(0, 20)) || cleanExisting.startsWith(cleanS.substring(0, 20)));
        });
      });
      if (missingSentences.length === 0) {
        isFullyAnalyzed = true;
      }
    } else {
      // Fallback: Full text case
      if (meta.sentenceAnalysis && meta.sentenceAnalysis.sentences && meta.sentenceAnalysis.sentences.length > 0) {
        isFullyAnalyzed = true;
      } else if (!fullText.trim()) {
        return NextResponse.json({ error: 'No transcript to analyze' }, { status: 400 });
      } else {
        // We will analyze full text
        missingSentences = [fullText];
      }
    }

    // 2. If already fully analyzed, return early with completed status
    if (isFullyAnalyzed) {
      return NextResponse.json({
        sentenceAnalysis: meta.sentenceAnalysis || { sentences: [] },
        status: 'completed'
      });
    }

    // 3. If missing sentences are present, check if a job is already running
    if (activeJobs.has(id)) {
      return NextResponse.json({
        sentenceAnalysis: meta.sentenceAnalysis || { sentences: [] },
        status: 'processing'
      });
    }

    // 4. Start background job if not running
    activeJobs.add(id);

    // Define background job
    const runAnalysisJob = async () => {
      try {
        const CHUNK_SIZE = 15;
        const totalMissing = missingSentences.length;

        logger.info(`[Analyze Job] Started background job for lesson ${id} (${totalMissing} sentences to analyze)`);

        // Helper to safely write analyzed sentences to disk
        const saveSentencesToMeta = (newlyAnalyzed: any[]) => {
          try {
            const freshMetaRaw = fs.readFileSync(metaPath, 'utf8');
            const freshMeta = JSON.parse(freshMetaRaw);

            if (!freshMeta.sentenceAnalysis) freshMeta.sentenceAnalysis = { sentences: [] };
            if (!freshMeta.sentenceAnalysis.sentences) freshMeta.sentenceAnalysis.sentences = [];

            for (const newS of newlyAnalyzed) {
              const cleanNew = (newS.english || '').toLowerCase().trim();
              if (!cleanNew) continue;

              const existingIdx = freshMeta.sentenceAnalysis.sentences.findIndex((s: any) => {
                const cleanExisting = (s.english || '').toLowerCase().trim();
                return cleanExisting === cleanNew;
              });

              if (existingIdx !== -1) {
                freshMeta.sentenceAnalysis.sentences[existingIdx] = newS;
              } else {
                freshMeta.sentenceAnalysis.sentences.push(newS);
              }
            }

            fs.writeFileSync(metaPath, JSON.stringify(freshMeta, null, 2), 'utf8');
            logger.info(`[Analyze Job] Successfully saved ${newlyAnalyzed.length} sentences to meta.json for lesson ${id}`);
          } catch (writeErr) {
            logger.error(`[Analyze Job] Error saving sentences to meta.json for lesson ${id}:`, writeErr);
          }
        };

        // If analyzing full text (represented as a single string fallback or single sentence)
        if (sentence || !sentences || !Array.isArray(sentences)) {
          const textToAnalyze = missingSentences[0];
          logger.info(`[Analyze Job] Processing single text/sentence analysis for ${id}`);
          const analysis = await generateSentenceAnalysisWithAI(textToAnalyze, apiKey, modelName, customUrl, provider);

          if (analysis && analysis.sentences && Array.isArray(analysis.sentences) && analysis.sentences.length > 0) {
            saveSentencesToMeta(analysis.sentences);
          } else {
            logger.error(`[Analyze Job] AI returned invalid results for single text analysis of ${id}`);
          }
        } else {
          // Batch analysis path with chunking
          if (totalMissing > CHUNK_SIZE) {
            logger.info(`[Analyze Job] Large batch detected for ${id}, chunking into batches of ${CHUNK_SIZE}`);
            for (let i = 0; i < totalMissing; i += CHUNK_SIZE) {
              const chunk = missingSentences.slice(i, i + CHUNK_SIZE);
              logger.info(`[Analyze Job] Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1}/${Math.ceil(totalMissing / CHUNK_SIZE)} for ${id}`);

              try {
                const chunkAnalysis = await generateSentenceAnalysisWithAI(chunk, apiKey, modelName, customUrl, provider);
                if (chunkAnalysis && chunkAnalysis.sentences && Array.isArray(chunkAnalysis.sentences)) {
                  saveSentencesToMeta(chunkAnalysis.sentences);
                } else {
                  logger.warn(`[Analyze Job] Chunk ${Math.floor(i / CHUNK_SIZE) + 1} returned no results for ${id}`);
                }
              } catch (chunkErr) {
                logger.error(`[Analyze Job] Error processing chunk ${Math.floor(i / CHUNK_SIZE) + 1} for ${id}:`, chunkErr);
              }
            }
          } else {
            // Small batch processed in one go
            logger.info(`[Analyze Job] Processing small batch of ${totalMissing} sentences for ${id}`);
            const analysis = await generateSentenceAnalysisWithAI(missingSentences, apiKey, modelName, customUrl, provider);

            if (analysis && analysis.sentences && Array.isArray(analysis.sentences) && analysis.sentences.length > 0) {
              saveSentencesToMeta(analysis.sentences);
            } else {
              logger.error(`[Analyze Job] AI returned invalid results for small batch analysis of ${id}`);
            }
          }
        }
      } catch (jobErr) {
        logger.error(`[Analyze Job] Uncaught error in background job for ${id}:`, jobErr);
      } finally {
        activeJobs.delete(id);
        logger.info(`[Analyze Job] Finished background job for lesson ${id}`);
      }
    };

    // Run background job asynchronously, do not wait!
    runAnalysisJob();

    // Return immediately to frontend
    return NextResponse.json({
      sentenceAnalysis: meta.sentenceAnalysis || { sentences: [] },
      status: 'processing'
    });

  } catch (error: any) {
    logger.error('Error analyzing lesson:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
