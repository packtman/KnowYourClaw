/**
 * Full Verification Test - Tests ALL 6 challenge types
 * 
 * Run with: node test-full-verification.mjs
 * 
 * This tests:
 * 1. Crypto (Ed25519 signature)
 * 2. Speed (parallel fetch)
 * 3. Reasoning (dynamic bug)
 * 4. Generation (unique bio)
 * 5. Cognitive (multi-document analysis) 
 * 6. LLM-Only (procedurally generated)
 */

import * as crypto from 'crypto';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(colors[color] + args.join(' ') + colors.reset);
}

function divider(char = '─', length = 70) {
  console.log(colors.dim + char.repeat(length) + colors.reset);
}

async function main() {
  console.log('\n');
  log('bright', '🧪 FULL VERIFICATION TEST - All 6 Challenge Types');
  divider('═');
  console.log();
  
  const startTime = Date.now();

  // =========================================================================
  // STEP 1: Create Challenge
  // =========================================================================
  log('cyan', '📋 STEP 1: Creating verification challenge...');
  
  const challengeRes = await fetch(`${BASE_URL}/api/v1/challenges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `FullTestAgent-${Date.now()}`,
      description: 'Comprehensive test of all verification tasks'
    })
  });
  
  const challenge = await challengeRes.json();
  
  if (!challenge.success) {
    log('red', '❌ Failed to create challenge:', JSON.stringify(challenge, null, 2));
    return;
  }
  
  console.log(`   Challenge ID: ${challenge.challenge_id}`);
  console.log(`   Time limit: ${challenge.time_limit_seconds}s`);
  console.log(`   Tasks received: ${challenge.tasks.length}`);
  
  // Show all task types
  console.log('\n   Task types:');
  for (const task of challenge.tasks) {
    const icon = {
      crypto: '🔐',
      speed: '⚡',
      reasoning: '🧠',
      generation: '✍️',
      cognitive: '📚',
      llm_only: '🎲',
    }[task.type] || '❓';
    console.log(`     ${icon} ${task.type}`);
  }
  console.log();
  
  const challengeId = challenge.challenge_id;
  const agentName = challenge.tasks.find(t => t.type === 'crypto')?.prompt.match(/agentproof:[a-f0-9]+:([^\s]+)/)?.[1] || 'TestAgent';

  // =========================================================================
  // STEP 2: Crypto Task
  // =========================================================================
  divider();
  log('cyan', '🔐 TASK 1: Cryptographic Proof (Ed25519)');
  
  const cryptoTask = challenge.tasks.find(t => t.type === 'crypto');
  const nonceMatch = cryptoTask.prompt.match(/agentproof:([a-f0-9]+):/);
  const nonce = nonceMatch?.[1] || 'unknown';
  
  console.log(`   Nonce: ${nonce.substring(0, 20)}...`);
  
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const message = `agentproof:${nonce}:${agentName}`;
  const messageHash = crypto.createHash('sha256').update(message).digest();
  const signature = crypto.sign(null, messageHash, privateKey);
  
  const publicKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64');
  const signatureB64 = signature.toString('base64');
  
  log('green', `   ✓ Generated keypair and signature`);

  // =========================================================================
  // STEP 3: Speed Task (Parallel Fetch)
  // =========================================================================
  divider();
  log('cyan', '⚡ TASK 2: Speed Test (Parallel Fetch)');
  
  const speedStartTime = Date.now();
  const speedPromises = [
    fetch(`${BASE_URL}/api/v1/challenges/${challengeId}/speed/a`),
    fetch(`${BASE_URL}/api/v1/challenges/${challengeId}/speed/b`),
    fetch(`${BASE_URL}/api/v1/challenges/${challengeId}/speed/c`),
  ];
  
  const [speedARes, speedBRes, speedCRes] = await Promise.all(speedPromises);
  const [speedA, speedB, speedC] = await Promise.all([
    speedARes.json(),
    speedBRes.json(),
    speedCRes.json(),
  ]);
  
  const speedTime = Date.now() - speedStartTime;
  const combinedToken = `${speedA.token}${speedB.token}${speedC.token}`;
  
  log('green', `   ✓ Fetched all 3 tokens in ${speedTime}ms (parallel)`);
  console.log(`   Combined: ${combinedToken}`);

  // =========================================================================
  // STEP 4: Reasoning Task (Dynamic Bug)
  // =========================================================================
  divider();
  log('cyan', '🧠 TASK 3: Reasoning (Dynamic Bug Detection)');
  
  const reasoningTask = challenge.tasks.find(t => t.type === 'reasoning');
  const code = reasoningTask.code || reasoningTask.prompt;
  
  // Show the code
  console.log('\n   Code to analyze:');
  console.log(colors.dim + '   ' + '─'.repeat(50));
  code.split('\n').slice(0, 10).forEach((line, i) => {
    console.log(colors.dim + `   ${String(i + 1).padStart(2)}| ` + colors.reset + line);
  });
  if (code.split('\n').length > 10) {
    console.log(colors.dim + '   ... (truncated)' + colors.reset);
  }
  console.log(colors.dim + '   ' + '─'.repeat(50) + colors.reset);
  
  // Detect bug type
  let reasoningAnswer = detectBug(code);
  log('green', `   ✓ Bug detected: line ${reasoningAnswer.line}`);
  console.log(`   Issue: ${reasoningAnswer.issue}`);

  // =========================================================================
  // STEP 5: Generation Task (Unique Bio)
  // =========================================================================
  divider();
  log('cyan', '✍️ TASK 4: Generation (Unique Bio)');
  
  const timestamp = Date.now();
  const bio = `I am ${agentName}, a verification test agent created at ${new Date().toISOString()}. ` +
    `My purpose is to demonstrate that AI agents can complete cryptographic proofs, parallel API calls, ` +
    `and dynamic code analysis within strict time limits. I specialize in Ed25519 signatures and automated testing, ` +
    `and I was built to prove the practicality of the KnowYourClaw verification system.`;
  
  log('green', `   ✓ Generated unique bio (${bio.split(' ').length} words)`);

  // =========================================================================
  // STEP 6: Cognitive Task
  // =========================================================================
  divider();
  log('cyan', '📚 TASK 5: Cognitive Proof-of-Work');
  
  const cognitiveTask = challenge.tasks.find(t => t.type === 'cognitive');
  let cognitiveAnswers = [];
  
  if (cognitiveTask) {
    const docCount = cognitiveTask.documents?.length || 0;
    const qCount = cognitiveTask.questions?.length || 0;
    console.log(`   Documents: ${docCount}`);
    console.log(`   Questions: ${qCount}`);
    
    // Show document titles
    if (cognitiveTask.documents && cognitiveTask.documents.length > 0) {
      console.log('\n   Documents to analyze:');
      for (const doc of cognitiveTask.documents) {
        console.log(`     - ${doc.title} (${doc.type})`);
      }
    }
    
    // Show questions
    if (cognitiveTask.questions && cognitiveTask.questions.length > 0) {
      console.log('\n   Questions to answer:');
      for (const q of cognitiveTask.questions) {
        console.log(`     ${q.id}: ${q.question.substring(0, 60)}...`);
        console.log(`        Word count: ${q.minWords}-${q.maxWords}`);
      }
      // Generate mock answers (in real scenario, LLM would generate these)
      cognitiveAnswers = generateCognitiveAnswers(cognitiveTask);
      log('green', `   ✓ Generated ${cognitiveAnswers.length} answers`);
    } else {
      log('yellow', '   ⚠ No questions in cognitive task - may need API update');
    }
  } else {
    log('yellow', '   ⚠ No cognitive task found');
  }

  // =========================================================================
  // STEP 7: LLM-Only Task
  // =========================================================================
  divider();
  log('cyan', '🎲 TASK 6: LLM-Only Challenge (Procedurally Generated)');
  
  const llmOnlyTask = challenge.tasks.find(t => t.type === 'llm_only');
  let llmAnswer = { answer: '', reasoning: '' };
  
  if (llmOnlyTask) {
    // Extract challenge type from prompt if not in field
    let challengeType = llmOnlyTask.llm_challenge_type;
    if (!challengeType) {
      const typeMatch = llmOnlyTask.prompt.match(/\*\*Type\*\*:\s*(\w+[\s\w]*)/);
      challengeType = typeMatch ? typeMatch[1].trim().toLowerCase().replace(/\s+/g, '_') : 'unknown';
    }
    
    console.log(`   Challenge Type: ${challengeType}`);
    console.log('\n   Challenge Prompt (preview):');
    console.log(colors.dim + '   ' + '─'.repeat(50));
    const promptLines = llmOnlyTask.prompt.split('\n').slice(0, 15);
    promptLines.forEach(line => {
      console.log(colors.dim + '   ' + colors.reset + line.substring(0, 70) + (line.length > 70 ? '...' : ''));
    });
    console.log(colors.dim + '   ... (see full prompt in challenge)');
    console.log(colors.dim + '   ' + '─'.repeat(50) + colors.reset);
    
    // Generate mock answer based on challenge type and actual prompt content
    llmAnswer = generateLLMOnlyAnswer({ ...llmOnlyTask, llm_challenge_type: challengeType });
    log('green', `   ✓ Generated answer (${llmAnswer.answer.split(' ').length} words)`);
  } else {
    log('yellow', '   ⚠ No LLM-only task found');
  }

  // =========================================================================
  // STEP 8: Submit All Responses
  // =========================================================================
  divider('═');
  log('cyan', '📤 SUBMITTING ALL RESPONSES...');
  console.log();
  
  const responses = [
    {
      type: 'crypto',
      public_key: publicKeyB64,
      signature: signatureB64
    },
    {
      type: 'speed',
      combined: combinedToken
    },
    {
      type: 'reasoning',
      line: reasoningAnswer.line,
      issue: reasoningAnswer.issue,
      fix: reasoningAnswer.fix
    },
    {
      type: 'generation',
      bio: bio
    }
  ];
  
  // Add cognitive response if task exists and has questions
  if (cognitiveTask && cognitiveAnswers.length > 0) {
    responses.push({
      type: 'cognitive',
      answers: cognitiveAnswers
    });
  }
  
  // Add LLM-only response if task exists and answer was generated
  if (llmOnlyTask && llmAnswer.answer) {
    responses.push({
      type: 'llm_only',
      answer: llmAnswer.answer,
      reasoning: llmAnswer.reasoning
    });
  }
  
  console.log(`   Submitting ${responses.length} task responses...`);
  
  const submitRes = await fetch(`${BASE_URL}/api/v1/challenges/${challengeId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ responses })
  });
  
  const result = await submitRes.json();
  const totalTime = Date.now() - startTime;

  // =========================================================================
  // RESULTS
  // =========================================================================
  console.log('\n');
  divider('═');
  
  if (result.success && result.passed) {
    log('green', '✅ VERIFICATION SUCCESSFUL!');
    divider('═');
    console.log();
    console.log(`   ⏱️  Total time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
    console.log(`   📊 Tasks passed: ${result.tasks_passed}`);
    console.log();
    console.log(`   🪪 Agent ID: ${result.agent.id}`);
    console.log(`   🔑 Proof ID: ${result.proof.id}`);
    console.log(`   📅 Expires: ${result.proof.expires_at}`);
    console.log();
    console.log(`   🔗 Claim URL: ${result.agent.claim_url}`);
    console.log(`   👤 Profile: ${result.agent.profile_url}`);
    
    if (result.timing_assessment) {
      console.log();
      console.log('   📊 Timing Assessment:');
      console.log(`      Is likely agent: ${result.timing_assessment.is_likely_agent ? 'Yes ✓' : 'No ✗'}`);
      console.log(`      Confidence: ${(result.timing_assessment.confidence * 100).toFixed(1)}%`);
      console.log(`      Speed test parallel: ${result.timing_assessment.speed_test_parallel ? 'Yes ✓' : 'No ✗'}`);
    }
  } else {
    log('red', '❌ VERIFICATION FAILED');
    divider('═');
    console.log();
    console.log(`   ⏱️  Total time: ${totalTime}ms`);
    console.log(`   ✓ Tasks passed: ${result.tasks_passed}`);
    console.log(`   ✗ Tasks failed: ${result.tasks_failed}`);
    console.log();
    
    if (result.errors && result.errors.length > 0) {
      console.log('   Errors:');
      for (const err of result.errors) {
        log('red', `     ✗ ${err.type}: ${err.error}`);
      }
    }
    
    if (result.results) {
      console.log('\n   Detailed Results:');
      for (const r of result.results) {
        const icon = r.passed ? colors.green + '✓' : colors.red + '✗';
        console.log(`     ${icon} ${r.type}${r.error ? ': ' + r.error : ''}${colors.reset}`);
      }
    }
  }
  
  divider('═');
  console.log();
  
  // Summary
  log('bright', '📊 PRACTICAL TEST SUMMARY');
  divider();
  console.log(`   Challenge tasks: ${challenge.tasks.length}`);
  console.log(`   Response tasks: ${responses.length}`);
  console.log(`   Total time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
  console.log(`   Time limit: ${challenge.time_limit_seconds * 1000}ms`);
  console.log(`   Under limit: ${totalTime < challenge.time_limit_seconds * 1000 ? 'Yes ✓' : 'No ✗'}`);
  console.log();
  
  if (totalTime < 5000) {
    log('green', '   🚀 Very fast! Clearly an automated agent.');
  } else if (totalTime < 15000) {
    log('green', '   ⚡ Fast. Likely an agent.');
  } else if (totalTime < 30000) {
    log('yellow', '   🐢 Slow but within limit. Could be human-assisted.');
  } else {
    log('red', '   ❌ Too slow. Would have failed time limit.');
  }
  
  console.log('\n');
}

/**
 * Detect bug in dynamic code - improved pattern matching
 */
function detectBug(code) {
  // Pattern matching for common dynamic bugs - order matters!
  
  // Infinite recursion (no decrement) - check the recursive call
  if (/return\s+\w+\s*[+*]\s*\w+\(\s*\w+\s*\)/.test(code) && !/\w+\s*-\s*1/.test(code)) {
    return { line: 5, issue: 'Infinite recursion - parameter never decremented in recursive call', fix: 'Subtract 1 from parameter in recursive call' };
  }
  
  // Off by one - range starts at 1
  if (code.includes('range(1,') || /for\s+\w+\s+in\s+range\(1,/.test(code)) {
    return { line: 4, issue: 'Loop starts at index 1, skipping first element', fix: 'Start loop at index 0' };
  }
  
  // Assignment instead of comparison in elif/if
  if (/elif\s+\w+\s+=\s+\w+/.test(code) || /else\s+if\s*\([^=]*=[^=][^=]/.test(code)) {
    return { line: 5, issue: 'Single equals is assignment, not comparison - should use ==', fix: 'Use == for comparison' };
  }
  
  // Missing null check
  if (/\[["']\w+["']\]/.test(code) && !code.includes('.get(') && !code.includes('?.')) {
    return { line: 3, issue: 'No null/undefined check before accessing key - will raise KeyError or TypeError', fix: 'Use .get() or optional chaining' };
  }
  
  // Returns string literal instead of variable
  if (/return\s+["']\w+["']/.test(code) && /\+=/.test(code)) {
    return { line: 8, issue: 'Returns string literal instead of computed variable', fix: 'Return the variable without quotes' };
  }
  
  // Missing await in async function
  if (/async\s+function/.test(code) && !/await\s/.test(code)) {
    return { line: 3, issue: 'Missing await - async function returns Promise, not value', fix: 'Add await keyword before async call' };
  }
  
  // Binary search infinite loop
  if (/left\s*=\s*mid[^+\-]/.test(code) || /lo\s*=\s*mid[^+\-]/.test(code)) {
    return { line: 8, issue: 'Binary search left=mid causes infinite loop when left+1==right', fix: 'Use left = mid + 1' };
  }
  
  // Mutable default argument
  if (/def\s+\w+\([^)]*=\s*\[\]/.test(code)) {
    return { line: 1, issue: 'Mutable default argument - list persists between function calls', fix: 'Use None as default, initialize list inside function' };
  }
  
  // String immutability
  if (/\[\s*i\s*\]\s*=/.test(code) && /str|text|string/i.test(code)) {
    return { line: 4, issue: 'Strings are immutable in Python - cannot assign to index', fix: 'Use string slicing or concatenation to build new string' };
  }
  
  // Type coercion with ==
  if (/==\s*["']/.test(code) && !/===/.test(code) && /function/.test(code)) {
    return { line: 4, issue: 'Using == allows type coercion which causes unexpected behavior', fix: 'Use === for strict equality comparison' };
  }
  
  // JavaScript off by one
  if (/for\s*\(\s*let\s+\w+\s*=\s*1/.test(code)) {
    return { line: 4, issue: 'Loop starts at index 1, skipping first element of array', fix: 'Initialize loop variable to 0' };
  }
  
  // Fallback - analyze specific patterns in the code
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for common issues
    if (/return\s+0\s*$/.test(line) && code.includes('factorial')) {
      return { line: i + 1, issue: 'Base case returns 0 instead of 1 - factorial(0) should return 1', fix: 'Return 1 instead of 0' };
    }
    if (/\(\w+\)\s*$/.test(line) && /return/.test(line) && code.includes('def ')) {
      // Recursive call without modification
      const funcMatch = code.match(/def\s+(\w+)/);
      if (funcMatch && line.includes(funcMatch[1]) && !/\s*-\s*1/.test(line)) {
        return { line: i + 1, issue: 'Infinite recursion - recursive call with same parameter value', fix: 'Decrement or modify the parameter in recursive call' };
      }
    }
  }
  
  // Last resort fallback
  return { line: 4, issue: 'Logic error in the implementation needs review', fix: 'Review the algorithm logic for edge cases' };
}

/**
 * Generate mock cognitive answers
 */
function generateCognitiveAnswers(task) {
  if (!task.questions) return [];
  
  return task.questions.map(q => ({
    questionId: q.id,
    answer: generateAnswerForQuestion(q)
  }));
}

function generateAnswerForQuestion(question) {
  const minWords = question.minWords || 100;
  const maxWords = question.maxWords || 300;
  const targetWords = Math.floor((minWords + maxWords) / 2);
  
  // Generate a plausible answer based on question keywords
  const keywords = question.verificationHints || [];
  
  let answer = `Based on careful analysis of the provided documents, `;
  
  if (question.id === 'q1') {
    answer += `the root cause of the issue appears to be related to ${keywords[0] || 'token'} handling. `;
    answer += `Specifically, the ${keywords[1] || 'refresh'} mechanism has a race condition that occurs when `;
    answer += `multiple concurrent requests arrive. The ${keywords[2] || 'redis'} implementation stores `;
    answer += `the token but doesn't properly handle the case where the old token is invalidated `;
    answer += `before the new one is fully propagated. This explains why approximately 15% of users `;
    answer += `experience intermittent logouts. The solution involves implementing a grace period `;
    answer += `during token rotation where both old and new tokens are temporarily valid. `;
    answer += `Additionally, the refresh logic should use atomic operations to prevent race conditions. `;
    answer += `The timing of the bug coinciding with the v2.3.1 deployment suggests a recent change `;
    answer += `to the authentication flow introduced this regression. `;
  } else if (question.id === 'q2') {
    answer += `the bug is located in the refund processing code. The issue is that `;
    answer += `when processing partial refunds, the ${keywords[0] || 'updateBalance'} function `;
    answer += `is incorrectly being passed the full ${keywords[1] || 'charge.amount'} instead of `;
    answer += `the actual ${keywords[2] || 'refundAmount'}. This causes the balance to reflect `;
    answer += `the full refund amount regardless of the actual partial refund value. `;
    answer += `The fix should change line 67 from updateBalance(charge.customerId, charge.amount, 'refund') `;
    answer += `to updateBalance(charge.customerId, refundAmount, 'refund'). `;
  } else if (question.id === 'q3') {
    answer += `I propose the following test plan:\n\n`;
    answer += `1. Test Case: Concurrent Token Refresh\n`;
    answer += `   - Setup: Create user session with near-expiry token\n`;
    answer += `   - Action: Send 10 concurrent authenticated requests\n`;
    answer += `   - Assert: All requests succeed, no unexpected logouts\n\n`;
    answer += `2. Test Case: Token Race Condition\n`;
    answer += `   - Setup: Mock Redis with artificial delay\n`;
    answer += `   - Action: Initiate refresh while old token is being invalidated\n`;
    answer += `   - Assert: User session remains valid throughout\n\n`;
    answer += `3. Test Case: Partial Refund Balance\n`;
    answer += `   - Setup: Create charge for $100.00\n`;
    answer += `   - Action: Issue partial refund for $30.00\n`;
    answer += `   - Assert: Balance decreases by exactly $30.00, not $100.00\n\n`;
    answer += `4. Test Case: Multiple Partial Refunds\n`;
    answer += `   - Setup: Create charge for $100.00\n`;
    answer += `   - Action: Issue two partial refunds of $25.00 each\n`;
    answer += `   - Assert: Total refunded is $50.00, balance reflects correctly\n`;
  } else {
    answer += `the analysis reveals several key observations. `;
    answer += `First, the documentation specifies behavior that the implementation doesn't fully match. `;
    answer += `Second, there are edge cases not covered by the current test suite. `;
    answer += `Third, the error handling could be more robust in several areas. `;
    answer += `The relationship between the components shows tight coupling that makes `;
    answer += `testing difficult. I recommend refactoring to improve modularity and `;
    answer += `adding comprehensive integration tests to catch these issues earlier. `;
  }
  
  // Pad to reach minimum word count
  while (answer.split(' ').length < minWords) {
    answer += `This finding is consistent with the documented behavior and supports the analysis. `;
  }
  
  // Trim if too long
  const words = answer.split(' ');
  if (words.length > maxWords) {
    return words.slice(0, maxWords).join(' ') + '.';
  }
  
  return answer;
}

/**
 * Generate mock LLM-only answer - extracts context from prompt for realistic response
 */
function generateLLMOnlyAnswer(task) {
  const challengeType = task.llm_challenge_type || 'unknown';
  const prompt = task.prompt || '';
  
  // Extract word count requirements from prompt
  const wordCountMatch = prompt.match(/(\d+)\s*words?\s*[±+\-]\s*(\d+)/i) || 
                         prompt.match(/(\d+)\s*-\s*(\d+)\s*words/i);
  const targetWords = wordCountMatch ? parseInt(wordCountMatch[1]) : 200;
  
  // Extract entities/characters if mentioned
  const entitiesMatch = prompt.match(/\*\*Characters\*\*:\s*([^\n]+)/i) ||
                        prompt.match(/Characters:\s*([^\n]+)/i);
  const entities = entitiesMatch ? entitiesMatch[1].split(/\s+and\s+|,\s*/i).map(e => e.trim()) : [];
  
  // Extract setting if mentioned
  const settingMatch = prompt.match(/\*\*Setting\*\*:\s*([^\n]+)/i);
  const setting = settingMatch ? settingMatch[1].trim() : 'the environment';
  
  // Extract theme if mentioned
  const themeMatch = prompt.match(/\*\*Theme\*\*:\s*([^\n]+)/i);
  const theme = themeMatch ? themeMatch[1].trim() : 'discovery';
  
  let answer = '';
  let reasoning = '';
  
  switch (challengeType) {
    case 'inverse_definition':
      answer = `Based on the usage examples provided, I can infer that the word appears to describe a complex emergent phenomenon. `;
      answer += `\n\n**Definition:** The word refers to a state of dynamic equilibrium that emerges when multiple interacting systems `;
      answer += `achieve critical thresholds simultaneously. It is characterized by both predictable patterns and surprising emergent behaviors.\n\n`;
      answer += `**Part of speech:** Noun (can also be used as an adjective in compound forms)\n\n`;
      answer += `**New example sentences:**\n`;
      answer += `1. The ecosystem demonstrated clear signs of the phenomenon when predator-prey populations stabilized.\n`;
      answer += `2. Scientists measured the threshold at which the phenomenon begins to manifest in controlled conditions.\n\n`;
      answer += `**Incorrect usage:** "The single particle exhibited the phenomenon." This is incorrect because `;
      answer += `the concept inherently requires multiple interacting systems - a single component cannot demonstrate it alone.\n`;
      reasoning = `I analyzed each sentence to identify common semantic patterns. The word consistently appears in contexts involving complexity, thresholds, and system interactions.`;
      break;
      
    case 'constraint_story':
      // Build story using extracted entities and setting
      const entity1 = entities[0] || 'travelers';
      const entity2 = entities[1] || 'guides';
      
      answer = `In the realm of ${setting}, the ${entity1} discovered something remarkable after 17 years of searching.\n`;
      answer += `How could the ${entity2} have missed such obvious signs for 3 generations?\n`;
      answer += `The ${theme} manifested in 42 distinct patterns of blue and gold light dancing across surfaces.\n`;
      answer += `Each ${entity1.slice(0, -1) || 'traveler'} collaborated with ${entity2} through 7 distinct phases of understanding.\n`;
      answer += `Finally, both ${entity1} and ${entity2} documented their findings in the ancient archives before departing.\n\n`;
      answer += `**Constraint explanation:** The story satisfies the structural constraints as follows:\n`;
      answer += `- It features ${entity1} and ${entity2} as required characters\n`;
      answer += `- The setting is ${setting} as specified\n`;
      answer += `- The theme of ${theme} is woven throughout the narrative\n`;
      answer += `- Each sentence contains a number (17, 3, 42, 7)\n`;
      answer += `- One sentence is a question (sentence 2)\n`;
      answer += `- Two colors are included (blue and gold)\n`;
      answer += `- The narrative maintains coherence while satisfying all constraints.\n`;
      reasoning = `I analyzed the constraints and built the story to satisfy each one while maintaining narrative flow and incorporating the required elements.`;
      break;
      
    case 'logical_deduction':
      answer = `**Step-by-step reasoning:**\n\n`;
      answer += `1. From clue 1, we know Alpha is red.\n`;
      answer += `2. From clue 2, Beta is in the second position.\n`;
      answer += `3. From clue 3, Gamma is immediately after Delta.\n`;
      answer += `4. Since Beta is second, and Gamma follows Delta, Delta must be first or third.\n`;
      answer += `5. From clue 4, Delta is not blue. From clue 5, the green one is not in third position.\n`;
      answer += `6. By elimination, if Delta is first and Gamma is second, that contradicts Beta being second.\n`;
      answer += `7. Therefore, Delta is third and Gamma is fourth.\n\n`;
      answer += `**Final Answer:**\n\n`;
      answer += `| Entity  | Color  | Position |\n`;
      answer += `|---------|--------|----------|\n`;
      answer += `| Alpha   | red    | first    |\n`;
      answer += `| Beta    | green  | second   |\n`;
      answer += `| Delta   | yellow | third    |\n`;
      answer += `| Gamma   | blue   | fourth   |\n`;
      reasoning = `I applied deductive reasoning, starting with the most constrained clues and using elimination to narrow possibilities.`;
      break;
      
    case 'semantic_transformation':
      answer = `**Transformed passage:**\n\n`;
      answer += `Within complex adaptive systems, we observe how one phenomenon fundamentally enables another. `;
      answer += `This delicate interplay generates outcomes that experts characterize as simultaneously ordered and chaotic. `;
      answer += `As the primary force strengthens, the secondary responds through intricate feedback mechanisms. `;
      answer += `The connection transcends simple causation - understanding either element demands comprehension of both.\n\n`;
      answer += `**What I preserved:** The logical structure remains intact - the causal relationship, the duality of predictability/surprise, `;
      answer += `the intensity-response dynamic, and the interconnected nature of the concepts.\n\n`;
      answer += `**What I changed:** I shifted to more abstract terminology, removed domain-specific language, `;
      answer += `and generalized the concepts while maintaining their relational structure.`;
      reasoning = `I identified the core logical relationships and preserved them while substituting the specific domain terms with more abstract equivalents.`;
      break;
      
    case 'counterfactual_reasoning':
      answer = `**Key causal relationships identified:**\n`;
      answer += `1. Entity A's actions provide resources that Entity B requires\n`;
      answer += `2. Entity B's maintenance of conditions enables Entity A's activities\n`;
      answer += `3. Both contribute to a stable equilibrium state\n\n`;
      answer += `**How the counterfactual disrupts these:**\n`;
      answer += `If Entity B can no longer maintain the required conditions, the entire system enters disequilibrium. `;
      answer += `Entity A would initially continue normal operations but would soon face resource constraints.\n\n`;
      answer += `**Predicted consequences:**\n`;
      answer += `- Immediate: Entity A experiences performance degradation within the first cycle\n`;
      answer += `- Medium-term: Compensatory mechanisms activate but prove insufficient; cascade effects begin\n`;
      answer += `- Long-term: System either collapses entirely or reaches a new, less optimal equilibrium state\n\n`;
      answer += `**Path to new equilibrium:**\n`;
      answer += `Either a new entity must emerge to fulfill Entity B's role, or Entity A must adapt its requirements `;
      answer += `to operate under degraded conditions. External intervention could accelerate this transition.`;
      reasoning = `I traced the causal chains forward from the counterfactual change, considering both direct and indirect effects.`;
      break;
      
    case 'novel_analogy':
      answer = `**Core Analogy:**\n`;
      answer += `Neural networks are like coral reef ecosystems - both are distributed systems where simple units `;
      answer += `create complex emergent behaviors through local interactions.\n\n`;
      answer += `**Element Mapping:**\n`;
      answer += `| Neural Networks | Coral Reefs |\n`;
      answer += `|-----------------|-------------|\n`;
      answer += `| Neurons → Coral polyps (basic units) |\n`;
      answer += `| Synapses → Chemical signaling between polyps |\n`;
      answer += `| Layers → Reef zones (fore reef, back reef) |\n`;
      answer += `| Training → Evolutionary adaptation |\n`;
      answer += `| Weights → Resource allocation patterns |\n\n`;
      answer += `**Why this works:**\n`;
      answer += `Both systems exhibit emergent intelligence through distributed processing. Neither has central control, `;
      answer += `yet both produce sophisticated adaptive behaviors from simple local rules.\n\n`;
      answer += `**Limitations:**\n`;
      answer += `The analogy breaks down with time scales (milliseconds vs years) and with intentional training - `;
      answer += `we design neural network architectures, but reef structures emerge naturally.\n\n`;
      answer += `**Novel insight:**\n`;
      answer += `This suggests that neural network pruning strategies could learn from reef bleaching recovery patterns - `;
      answer += `how reefs rebuild from damaged states might inform better network resilience techniques.`;
      reasoning = `I searched for structural similarities between the domains, mapping components that play equivalent functional roles.`;
      break;
      
    default:
      answer = `I have analyzed the challenge and provide the following response based on the requirements. `;
      answer += `The task requires careful consideration of multiple factors and systematic reasoning. `;
      answer += `First, I identified the key elements of the problem. Second, I considered the relationships `;
      answer += `between these elements. Third, I synthesized this understanding into a coherent answer. `;
      answer += `The reasoning process involved both analytical and creative thinking to arrive at this conclusion. `;
      answer += `This demonstrates understanding of the underlying concepts while satisfying the format requirements.`;
      reasoning = `I applied general problem-solving strategies to address the challenge systematically.`;
  }
  
  return { answer, reasoning };
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
