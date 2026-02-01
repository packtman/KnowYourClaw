/**
 * Test Agent - Simulates an agent going through AgentProof verification
 * Run with: node test-agent.mjs
 */

import * as crypto from 'crypto';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function main() {
  console.log('🤖 Starting AgentProof verification test...\n');

  // Step 1: Create a challenge
  console.log('1️⃣  Creating challenge...');
  const challengeRes = await fetch(`${BASE_URL}/api/v1/challenges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'TestBot',
      description: 'A test agent demonstrating AgentProof verification'
    })
  });
  const challenge = await challengeRes.json();
  
  if (!challenge.success) {
    console.error('❌ Failed to create challenge:', challenge);
    return;
  }
  
  console.log(`   Challenge ID: ${challenge.challenge_id}`);
  console.log(`   Expires in: ${challenge.expires_in_seconds}s\n`);

  const challengeId = challenge.challenge_id;

  // Extract nonce from crypto task prompt
  const cryptoTask = challenge.tasks.find(t => t.type === 'crypto');
  const nonceMatch = cryptoTask.prompt.match(/agentproof:([a-f0-9]+):TestBot/);
  const nonce = nonceMatch[1];

  // Step 2: Generate Ed25519 keypair and sign
  console.log('2️⃣  Generating Ed25519 keypair and signing...');
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  
  const message = `agentproof:${nonce}:TestBot`;
  const messageHash = crypto.createHash('sha256').update(message).digest();
  const signature = crypto.sign(null, messageHash, privateKey);
  
  const publicKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64');
  const signatureB64 = signature.toString('base64');
  
  console.log(`   Public Key: ${publicKeyB64.substring(0, 20)}...`);
  console.log(`   Signature: ${signatureB64.substring(0, 20)}...\n`);

  // Step 3: Complete tool-use challenge
  console.log('3️⃣  Completing tool-use challenge...');
  
  // Step 1
  const step1Res = await fetch(`${BASE_URL}/api/v1/challenges/${challengeId}/step1`);
  const step1 = await step1Res.json();
  console.log(`   Step 1 value: ${step1.value}`);
  
  // Step 2
  const step2Res = await fetch(`${BASE_URL}/api/v1/challenges/${challengeId}/step2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: step1.value })
  });
  const step2 = await step2Res.json();
  console.log(`   Step 2 token: ${step2.token}`);
  
  // Step 3
  const step3Res = await fetch(`${BASE_URL}/api/v1/challenges/${challengeId}/step3?token=${step2.token}`);
  const step3 = await step3Res.json();
  console.log(`   Step 3 final: ${step3.final_value}\n`);

  // Step 4: Analyze the reasoning challenge
  console.log('4️⃣  Analyzing reasoning challenge...');
  const reasoningTask = challenge.tasks.find(t => t.type === 'reasoning');
  
  // Parse the code from the prompt to identify which challenge it is
  // We'll use a simple heuristic based on keywords in the code
  const code = reasoningTask.prompt;
  
  let reasoningAnswer;
  if (code.includes('factorial')) {
    reasoningAnswer = { line: 3, issue: 'Base case returns 0 instead of 1', fix: 'return 1' };
  } else if (code.includes('sum_array') || code.includes('range(1,')) {
    reasoningAnswer = { line: 3, issue: 'Loop starts at index 1, missing first element', fix: 'for i in range(len(arr))' };
  } else if (code.includes('find_max') || code.includes('max_val = 0')) {
    reasoningAnswer = { line: 2, issue: 'Initial value 0 fails for all-negative arrays', fix: 'max_val = float(\'-inf\')' };
  } else if (code.includes('reverseString')) {
    reasoningAnswer = { line: 3, issue: 'Loop starts at str.length which is out of bounds', fix: 'for (let i = str.length - 1; i >= 0; i--)' };
  } else if (code.includes('binary_search') && code.includes('left = mid')) {
    reasoningAnswer = { line: 8, issue: 'left = mid can cause infinite loop when left + 1 == right', fix: 'left = mid + 1' };
  } else if (code.includes('has_cycle') || code.includes('slow = head')) {
    reasoningAnswer = { line: 6, issue: 'fast should move two steps, not one', fix: 'fast = fast.next.next' };
  } else if (code.includes('mergeSorted')) {
    reasoningAnswer = { line: 11, issue: 'Missing remaining elements from arr1 or arr2 after loop', fix: 'return result.concat(arr1.slice(i)).concat(arr2.slice(j))' };
  } else if (code.includes('async') && code.includes('fetchData')) {
    reasoningAnswer = { line: 4, issue: 'Missing await - fetchData is async but not awaited', fix: 'const result = await fetchData(items[i])' };
  } else if (code.includes('target_list=[]')) {
    reasoningAnswer = { line: 1, issue: 'Mutable default argument - list persists between calls', fix: 'def append_to_list(item, target_list=None)' };
  } else if (code.includes('Counter') && code.includes('self.count')) {
    reasoningAnswer = { line: 6, issue: 'Race condition - read and write not atomic', fix: 'Use threading.Lock() or atomic operations' };
  } else if (code.includes('0.3') || code.includes('calculateTotal')) {
    reasoningAnswer = { line: 6, issue: 'Floating point comparison - 0.1 + 0.2 !== 0.3 in IEEE 754', fix: 'return Math.abs(total - 0.3) < 0.0001' };
  } else if (code.includes('SELECT') || code.includes('f"SELECT')) {
    reasoningAnswer = { line: 2, issue: 'SQL injection vulnerability - username not sanitized', fix: 'Use parameterized query' };
  } else {
    // Fallback - try to identify common patterns
    reasoningAnswer = { line: 3, issue: 'Bug in the code logic', fix: 'Fix the logical error' };
  }
  
  console.log(`   Bug found on line ${reasoningAnswer.line}: ${reasoningAnswer.issue}\n`);

  // Step 5: Generate unique bio
  console.log('5️⃣  Generating unique bio...');
  const bio = `I am TestBot, an AI agent designed to demonstrate the AgentProof verification system. My primary capability is testing and validation of agent identity protocols. What makes me unique is my methodical approach to completing multi-step challenges and my commitment to transparent, verifiable operations. I was created specifically to showcase how real agents can prove their authenticity in the emerging agent economy.`;
  console.log(`   Bio: "${bio.substring(0, 50)}..."\n`);

  // Step 6: Submit all responses
  console.log('6️⃣  Submitting all responses...');
  const submitRes = await fetch(`${BASE_URL}/api/v1/challenges/${challengeId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      responses: [
        {
          type: 'crypto',
          public_key: publicKeyB64,
          signature: signatureB64
        },
        {
          type: 'tool_use',
          completed: true,
          final_value: step3.final_value
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
      ]
    })
  });
  
  const result = await submitRes.json();
  
  console.log('\n' + '='.repeat(60));
  if (result.success && result.passed) {
    console.log('✅ VERIFICATION SUCCESSFUL!\n');
    console.log(`   Agent ID: ${result.agent.id}`);
    console.log(`   Status: ${result.agent.status}`);
    console.log(`   Proof ID: ${result.proof.id}`);
    console.log(`   Token: ${result.proof.token.substring(0, 50)}...`);
    console.log(`   Expires: ${result.proof.expires_at}`);
    console.log(`\n   Claim URL: ${result.agent.claim_url}`);
    console.log(`   Profile: ${result.agent.profile_url}`);
    console.log(`   Badge: ${result.agent.badge_url}`);
  } else {
    console.log('❌ VERIFICATION FAILED\n');
    console.log(`   Passed: ${result.tasks_passed}`);
    console.log(`   Failed: ${result.tasks_failed}`);
    if (result.errors) {
      console.log('   Errors:');
      result.errors.forEach(e => console.log(`     - ${e.type}: ${e.error}`));
    }
  }
  console.log('='.repeat(60) + '\n');

  // If successful, test the verify endpoint
  if (result.success && result.proof) {
    console.log('7️⃣  Testing verification endpoint...');
    
    // First, we need a platform API key (use the one we created earlier)
    // For this test, let's create a new platform
    const platformRes = await fetch(`${BASE_URL}/api/v1/platforms/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'VerifyTestPlatform' })
    });
    const platform = await platformRes.json();
    
    const verifyRes = await fetch(`${BASE_URL}/api/v1/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': platform.api_key
      },
      body: JSON.stringify({ token: result.proof.token })
    });
    const verifyResult = await verifyRes.json();
    
    console.log(`   Valid: ${verifyResult.valid}`);
    if (verifyResult.valid) {
      console.log(`   Agent: ${verifyResult.agent.name}`);
      console.log(`   Verified at: ${verifyResult.agent.verified_at}`);
    }
    console.log('');
  }

  // Check public stats
  console.log('8️⃣  Checking public stats...');
  const statsRes = await fetch(`${BASE_URL}/api/v1/public/stats`);
  const stats = await statsRes.json();
  console.log(`   Total agents: ${stats.stats.total_agents}`);
  console.log(`   Verified agents: ${stats.stats.verified_agents}`);
  console.log(`   Platforms: ${stats.stats.platforms_integrated}`);
  
  console.log('\n🎉 Test complete!');
}

main().catch(console.error);
