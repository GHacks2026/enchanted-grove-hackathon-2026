import fs from 'fs';
import path from 'path';
import { findQuote, normalize } from '../lib/grounding';
import { generateStructured } from '../lib/llm';
import { buildExtractionUserMessage, buildRetryAddendum, EXTRACTION_SYSTEM_PROMPT } from '../lib/prompts';
import { buildExtractionSchema, type RawExtraction } from '../lib/schemas';
import type { Pillar } from '../lib/types';

interface ExpectedItem {
  evidence_quote: string;
  pillar_id: string | null;
}

interface Entry {
  id: string;
  goal?: string;
  pillars: Array<{ id: string; name: string }>;
  journal: string;
  expected_blooms: ExpectedItem[];
  expected_friction: ExpectedItem[];
}

// Standalone extraction + grounding validation logic for eval runner
async function extractAndValidate(opts: {
  journal: string;
  goal?: string;
  pillars: Array<{ id: string; name: string }>;
}) {
  // Map pillars to match domain Pillar type required by lib/prompts.ts
  const fullPillars: Pillar[] = opts.pillars.map((p, idx) => ({
    id: p.id,
    grove_id: 'eval-grove',
    goal_id: 'eval-goal',
    user_id: 'eval-user',
    name: p.name,
    description: "",
    position: idx,
    origin: 'user' as const,
    ai_original_name: null,
    archived_at: null,
  }));

  // Build the dynamic Zod schema using pillar IDs
  const pillarIds = opts.pillars.map((p) => p.id) as [string, ...string[]];
  const schema = buildExtractionSchema(pillarIds);

  const goalText = opts.goal || 'Achieve goal';
  const userMessage = buildExtractionUserMessage(goalText, fullPillars, opts.journal, null);
  const systemPrompt = EXTRACTION_SYSTEM_PROMPT;

  // First LLM extraction attempt
  let response = await generateStructured<RawExtraction>({
    schema: schema,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  // Verify quotes with findQuote
  const failedQuotes: string[] = [];

  (response.blooms || []).forEach((b) => {
    if (!findQuote(opts.journal, b.evidence_quote)) {
      failedQuotes.push(b.evidence_quote);
    }
  });

  (response.friction || []).forEach((f) => {
    if (!findQuote(opts.journal, f.evidence_quote)) {
      failedQuotes.push(f.evidence_quote);
    }
  });

  // Self-correction retry if any quote failed grounding
  if (failedQuotes.length > 0) {
    const retryAddendum = buildRetryAddendum(failedQuotes);
    response = await generateStructured<RawExtraction>({
      schema: schema,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
        { role: 'assistant', content: JSON.stringify(response) },
        { role: 'user', content: retryAddendum },
      ],
    });
  }

  return {
    blooms: response.blooms || [],
    friction: response.friction || [],
  };
}

async function runEval() {
  const entriesPath = path.join(__dirname, 'entries.json');
  let entries: Entry[] = JSON.parse(fs.readFileSync(entriesPath, 'utf-8'));

  // Support --limit flag (e.g. npx tsx eval/run.ts --limit 3)
  const limitArgIdx = process.argv.indexOf('--limit');
  if (limitArgIdx !== -1 && process.argv[limitArgIdx + 1]) {
    const limit = parseInt(process.argv[limitArgIdx + 1], 10);
    if (!isNaN(limit)) {
      entries = entries.slice(0, limit);
      console.log(`Running evaluation on first ${limit} entries...`);
    }
  }

  // Step 1: Pre-flight quote verification against human answer key
  console.log('Checking expected quotes in answer key...');
  for (const entry of entries) {
    for (const b of entry.expected_blooms) {
      if (!findQuote(entry.journal, b.evidence_quote)) {
        console.error(
          `Quote error in entry ${entry.id}: "${b.evidence_quote}" not found in journal.`
        );
        process.exit(1);
      }
    }
    for (const f of entry.expected_friction) {
      if (!findQuote(entry.journal, f.evidence_quote)) {
        console.error(
          `Quote error in entry ${entry.id}: "${f.evidence_quote}" not found in journal.`
        );
        process.exit(1);
      }
    }
  }
  console.log('All human answer key quotes are valid verbatim substrings!\n');

  // Metric accumulators
  let totalExpectedBlooms = 0;
  let totalPredictedBlooms = 0;
  let matchedBlooms = 0;
  let correctPillars = 0;

  let totalExpectedFriction = 0;
  let totalPredictedFriction = 0;
  let matchedFriction = 0;

  let noProgressExpected = 0;
  let noProgressCorrect = 0;

  let totalQuotesShown = 0;
  let ungroundedQuotes = 0;

  const mismatches: any[] = [];

  // Step 2: Run evaluation on entries
  for (const entry of entries) {
    const result = await extractAndValidate({
      journal: entry.journal,
      goal: entry.goal,
      pillars: entry.pillars,
    });

    const predictedBlooms = result.blooms || [];
    const predictedFriction = result.friction || [];

    // Check Grounding (0% target)
    for (const item of [...predictedBlooms, ...predictedFriction]) {
      totalQuotesShown++;
      if (!findQuote(entry.journal, item.evidence_quote)) {
        ungroundedQuotes++;
      }
    }

    // Bloom Matching
    totalExpectedBlooms += entry.expected_blooms.length;
    totalPredictedBlooms += predictedBlooms.length;

    const matchedExpectedIndices = new Set<number>();
    for (const pred of predictedBlooms) {
      let foundMatch = false;
      for (let i = 0; i < entry.expected_blooms.length; i++) {
        if (matchedExpectedIndices.has(i)) continue;
        const exp = entry.expected_blooms[i];

        // Quote containment/overlap check
        const normPred = normalize(pred.evidence_quote);
        const normExp = normalize(exp.evidence_quote);
        if (normPred.includes(normExp) || normExp.includes(normPred)) {
          matchedBlooms++;
          matchedExpectedIndices.add(i);
          foundMatch = true;
          if (pred.pillar_id === exp.pillar_id) {
            correctPillars++;
          }
          break;
        }
      }
      if (!foundMatch) {
        mismatches.push({
          entry_id: entry.id,
          type: 'bloom_precision_fail',
          predicted: pred,
        });
      }
    }

    // No-Progress Check
    if (entry.expected_blooms.length === 0) {
      noProgressExpected++;
      if (predictedBlooms.length === 0) {
        noProgressCorrect++;
      }
    }

    // Friction Matching
    totalExpectedFriction += entry.expected_friction.length;
    totalPredictedFriction += predictedFriction.length;

    const matchedFrictionIndices = new Set<number>();
    for (const pred of predictedFriction) {
      for (let i = 0; i < entry.expected_friction.length; i++) {
        if (matchedFrictionIndices.has(i)) continue;
        const exp = entry.expected_friction[i];
        const normPred = normalize(pred.evidence_quote);
        const normExp = normalize(exp.evidence_quote);
        if (normPred.includes(normExp) || normExp.includes(normPred)) {
          matchedFriction++;
          matchedFrictionIndices.add(i);
          break;
        }
      }
    }
  }

  // Final Metric Calculations
  const bloomRecall =
    totalExpectedBlooms > 0 ? matchedBlooms / totalExpectedBlooms : 1;
  const bloomPrecision =
    totalPredictedBlooms > 0 ? matchedBlooms / totalPredictedBlooms : 1;
  const pillarAccuracy =
    matchedBlooms > 0 ? correctPillars / matchedBlooms : 1;
  const noProgressAccuracy =
    noProgressExpected > 0 ? noProgressCorrect / noProgressExpected : 1;
  const ungroundedRate =
    totalQuotesShown > 0 ? ungroundedQuotes / totalQuotesShown : 0;

  const summary = {
    ungrounded_quote_rate: `${(ungroundedRate * 100).toFixed(1)}%`,
    bloom_precision: `${(bloomPrecision * 100).toFixed(1)}%`,
    bloom_recall: `${(bloomRecall * 100).toFixed(1)}%`,
    pillar_accuracy: `${(pillarAccuracy * 100).toFixed(1)}%`,
    no_progress_accuracy: `${(noProgressAccuracy * 100).toFixed(1)}%`,
    total_entries_tested: entries.length,
  };

  console.log('=== EVALUATION SUMMARY ===');
  console.table(summary);

  // Save full output to eval/results.json
  fs.writeFileSync(
    path.join(__dirname, 'results.json'),
    JSON.stringify({ summary, mismatches }, null, 2)
  );
  console.log('\nResults written to eval/results.json');
}

runEval().catch(console.error);