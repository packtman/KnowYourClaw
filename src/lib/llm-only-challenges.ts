/**
 * LLM-Only Challenges
 * 
 * Non-deterministic challenges that ONLY language models can solve.
 * Each challenge is procedurally generated and unique per agent.
 * 
 * Design principles:
 * 1. PROCEDURAL GENERATION - Every challenge is unique, can't be memorized
 * 2. SEMANTIC UNDERSTANDING - Requires understanding meaning, not pattern matching
 * 3. CHAIN-OF-THOUGHT - Requires multi-step reasoning
 * 4. VERIFIABLE WITHOUT KNOWING ANSWER - We can check correctness without having the answer
 * 5. NO TEMPLATES - Pure randomization with semantic constraints
 */

import { generateToken } from "./crypto.js";

// ============================================================================
// TYPES
// ============================================================================

export interface LLMOnlyChallenge {
  id: string;
  type: LLMChallengeType;
  seed: string; // Unique seed for reproducibility if needed
  prompt: string;
  context: string;
  verification: LLMVerification;
  estimatedTokens: number;
  generatedAt: string;
}

export type LLMChallengeType = 
  | "inverse_definition"
  | "constraint_story"
  | "logical_deduction"
  | "semantic_transformation"
  | "counterfactual_reasoning"
  | "novel_analogy";

export interface LLMVerification {
  type: "semantic" | "structural" | "logical" | "constraint";
  checks: VerificationCheck[];
  minWords: number;
  maxWords: number;
}

export interface VerificationCheck {
  type: string;
  params: Record<string, any>;
  weight: number;
}

export interface LLMChallengeResponse {
  answer: string;
  reasoning?: string;
}

// ============================================================================
// WORD POOLS FOR PROCEDURAL GENERATION
// ============================================================================

const ABSTRACT_CONCEPTS = [
  "trust", "chaos", "harmony", "decay", "emergence", "recursion", "entropy",
  "resonance", "threshold", "equilibrium", "paradox", "symmetry", "flow",
  "resistance", "catalyst", "horizon", "echo", "drift", "convergence",
  "divergence", "inertia", "momentum", "tension", "release", "boundary",
  "interface", "gradient", "cascade", "feedback", "oscillation"
];

const DOMAINS = [
  "quantum computing", "forest ecosystems", "medieval economics", "jazz improvisation",
  "cellular biology", "urban planning", "volcanic activity", "neural networks",
  "ancient astronomy", "modern logistics", "coral reef dynamics", "radio wave propagation",
  "fermentation processes", "plate tectonics", "swarm intelligence", "color theory",
  "fluid dynamics", "cryptographic protocols", "linguistic evolution", "market psychology"
];

const ENTITIES = [
  "architects", "rivers", "algorithms", "merchants", "crystals", "composers",
  "bacteria", "bridges", "explorers", "frequencies", "gardeners", "protocols",
  "translators", "volcanoes", "weavers", "signals", "shepherds", "currencies",
  "navigators", "enzymes", "librarians", "tides", "cartographers", "membranes"
];

const ACTIONS = [
  "transform", "negotiate", "dissolve", "amplify", "calibrate", "inherit",
  "fragment", "synthesize", "erode", "cultivate", "intercept", "modulate",
  "preserve", "redistribute", "synchronize", "contaminate", "fortify", "dilute",
  "transcribe", "bifurcate", "coalesce", "attenuate", "propagate", "sequester"
];

const PROPERTIES = [
  "volatile", "resilient", "opaque", "recursive", "ephemeral", "granular",
  "asymmetric", "latent", "ambient", "discrete", "fractal", "viscous",
  "refractive", "permeable", "crystalline", "stochastic", "harmonic", "entropic",
  "isotropic", "anisotropic", "homeostatic", "metastable", "ergodic", "aperiodic"
];

const CONSTRAINTS = [
  "without using negation",
  "using only concrete nouns",
  "in exactly three paragraphs",
  "where each sentence builds on the previous",
  "using a problem-solution-implication structure",
  "alternating between abstract and concrete",
  "maintaining a consistent metaphor throughout",
  "with each paragraph starting with a question",
  "using cause-effect chains",
  "with explicit logical connectors between ideas"
];

const RELATIONSHIPS = [
  "enables", "undermines", "reflects", "inverts", "amplifies", "constrains",
  "precedes", "emerges from", "stabilizes", "disrupts", "encodes", "mediates",
  "accelerates", "filters", "bridges", "isolates", "translates", "buffers"
];

// ============================================================================
// RANDOM UTILITIES
// ============================================================================

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function pickN<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

// ============================================================================
// CHALLENGE GENERATORS
// ============================================================================

/**
 * INVERSE DEFINITION CHALLENGE
 * 
 * Agent must create a definition for a made-up word based on usage examples.
 * Scripts can't solve this because the "word" doesn't exist - requires semantic inference.
 */
function generateInverseDefinition(): LLMOnlyChallenge {
  const seed = generateToken(8);
  
  // Generate a nonsense word that sounds plausible
  const prefixes = ["xeno", "meta", "para", "syn", "anti", "proto", "neo", "quasi", "pseudo", "semi"];
  const roots = ["flux", "morph", "crypt", "graph", "path", "chrome", "scope", "phon", "trop", "genic"];
  const suffixes = ["ation", "ence", "ity", "ism", "osis", "ure", "ment", "ics", "oid", "ian"];
  
  const madeUpWord = randomChoice(prefixes) + randomChoice(roots) + randomChoice(suffixes);
  
  // Generate 4-5 example sentences using the word with consistent meaning
  const concept = randomChoice(ABSTRACT_CONCEPTS);
  const domain = randomChoice(DOMAINS);
  const property = randomChoice(PROPERTIES);
  
  const exampleTemplates = [
    `The ${property} nature of ${domain} demonstrates classic ${madeUpWord}.`,
    `Researchers studying ${domain} observed ${madeUpWord} occurring when ${concept} reached critical levels.`,
    `Unlike simple ${concept}, ${madeUpWord} requires multiple interacting systems.`,
    `The ${madeUpWord} effect was first documented in ${domain} experiments.`,
    `When ${concept} and ${property} conditions align, ${madeUpWord} becomes inevitable.`,
    `Critics argue that true ${madeUpWord} is distinguishable from mere ${concept}.`,
    `The ${madeUpWord} threshold varies depending on ambient ${property} factors.`,
  ];
  
  const examples = pickN(exampleTemplates, 5);
  
  const prompt = `INVERSE DEFINITION CHALLENGE

The word "${madeUpWord}" is used in the following sentences:

${examples.map((e, i) => `${i + 1}. ${e}`).join("\n")}

Based ONLY on how the word is used in these examples, provide:

1. A precise definition of "${madeUpWord}" (2-3 sentences)
2. The part of speech (noun, verb, adjective, etc.)
3. Two NEW example sentences using the word correctly
4. One example of INCORRECT usage and explain why it's wrong

Your definition must be consistent with ALL the example sentences above.`;

  return {
    id: `llm_${seed}`,
    type: "inverse_definition",
    seed,
    prompt,
    context: JSON.stringify({ madeUpWord, concept, domain, property, examples }),
    verification: {
      type: "semantic",
      checks: [
        { type: "mentions_word", params: { word: madeUpWord, minCount: 4 }, weight: 20 },
        { type: "has_definition_structure", params: {}, weight: 30 },
        { type: "provides_examples", params: { minCount: 3 }, weight: 25 },
        { type: "shows_reasoning", params: {}, weight: 25 },
      ],
      minWords: 75,
      maxWords: 400,
    },
    estimatedTokens: 800,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * CONSTRAINT STORY CHALLENGE
 * 
 * Agent must write a coherent micro-story with multiple unusual constraints.
 * Scripts can't solve this because constraints are randomly combined.
 */
function generateConstraintStory(): LLMOnlyChallenge {
  const seed = generateToken(8);
  
  // Pick random constraints
  const entities = pickN(ENTITIES, 2);
  const setting = randomChoice(DOMAINS);
  const theme = randomChoice(ABSTRACT_CONCEPTS);
  const wordCount = randomInt(80, 120);
  
  // Generate unique structural constraints
  const structuralConstraints = [
    `exactly ${randomInt(4, 6)} sentences`,
    `the first and last words must rhyme`,
    `include exactly one question`,
    `each sentence must be longer than the previous`,
    `no sentence can use the letter '${randomChoice(["e", "a", "i", "o", "s"])}'`,
    `every sentence must contain a number`,
    `use at least 3 words with exactly 4 letters`,
    `the middle sentence must be a single word`,
    `alternate between past and present tense`,
    `include exactly 2 colors`,
  ];
  
  const selectedConstraints = pickN(structuralConstraints, 3);
  
  const prompt = `CONSTRAINT STORY CHALLENGE

Write a micro-story (${wordCount} words ±10) that satisfies ALL of these constraints:

**Setting**: ${setting}
**Characters**: ${entities.join(" and ")}
**Theme**: ${theme}

**Structural constraints**:
${selectedConstraints.map((c, i) => `${i + 1}. ${c}`).join("\n")}

After your story, explain in 2-3 sentences how you satisfied each constraint.

IMPORTANT: The story must be coherent and meaningful, not just constraint-satisfying gibberish.`;

  return {
    id: `llm_${seed}`,
    type: "constraint_story",
    seed,
    prompt,
    context: JSON.stringify({ entities, setting, theme, wordCount, constraints: selectedConstraints }),
    verification: {
      type: "constraint",
      checks: [
        { type: "word_count_range", params: { min: wordCount - 15, max: wordCount + 15 }, weight: 20 },
        { type: "mentions_entities", params: { entities }, weight: 20 },
        { type: "includes_explanation", params: {}, weight: 30 },
        { type: "coherent_narrative", params: {}, weight: 30 },
      ],
      minWords: 75,
      maxWords: 300,
    },
    estimatedTokens: 600,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * LOGICAL DEDUCTION CHALLENGE
 * 
 * Agent must solve a procedurally generated logic puzzle.
 * Scripts can't solve this because the puzzle is unique each time.
 */
function generateLogicalDeduction(): LLMOnlyChallenge {
  const seed = generateToken(8);
  
  // Generate entities and attributes for the puzzle
  const entityNames = pickN(["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Theta", "Omega"], 4);
  const attributes = pickN(["red", "blue", "green", "yellow"], 4);
  const positions = ["first", "second", "third", "fourth"];
  
  // Create the solution
  const solution: Record<string, { color: string; position: string }> = {};
  const shuffledColors = shuffle([...attributes]);
  const shuffledPositions = shuffle([...positions]);
  
  entityNames.forEach((name, i) => {
    solution[name] = { color: shuffledColors[i], position: shuffledPositions[i] };
  });
  
  // Generate clues that uniquely determine the solution
  const clues: string[] = [];
  
  // Direct clues
  const directEntity = randomChoice(entityNames);
  clues.push(`${directEntity} is ${solution[directEntity].color}.`);
  
  // Position clues
  const posEntity1 = entityNames.find(e => e !== directEntity)!;
  clues.push(`${posEntity1} is in the ${solution[posEntity1].position} position.`);
  
  // Relative clues
  const posEntity2 = entityNames.find(e => e !== directEntity && e !== posEntity1)!;
  const posIndex = positions.indexOf(solution[posEntity2].position);
  if (posIndex > 0) {
    const beforeEntity = entityNames.find(e => solution[e].position === positions[posIndex - 1])!;
    clues.push(`${posEntity2} is immediately after ${beforeEntity}.`);
  } else {
    clues.push(`${posEntity2} is first.`);
  }
  
  // Negative clues
  const negEntity = entityNames.find(e => e !== directEntity && e !== posEntity1 && e !== posEntity2)!;
  const wrongColors = attributes.filter(c => c !== solution[negEntity].color);
  clues.push(`${negEntity} is not ${randomChoice(wrongColors)}.`);
  clues.push(`The ${randomChoice(attributes.filter(c => c !== solution[negEntity].color && c !== solution[directEntity].color))} one is not in the ${solution[negEntity].position} position.`);
  
  // Add one more distinctive clue
  const colorPosClue = entityNames.find(e => solution[e].position === "second" || solution[e].position === "third");
  if (colorPosClue) {
    clues.push(`The ${solution[colorPosClue].color} entity is in the ${solution[colorPosClue].position} position.`);
  }
  
  const shuffledClues = shuffle(clues);
  
  const prompt = `LOGICAL DEDUCTION CHALLENGE

Four entities (${entityNames.join(", ")}) each have a color (${attributes.join(", ")}) and a position (first through fourth). Each attribute is used exactly once.

**Clues:**
${shuffledClues.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Determine the color and position of each entity.

**Required format:**
1. Show your step-by-step reasoning
2. For each clue, explain what it tells you
3. State your final answer as a table:
   Entity | Color | Position
   -------|-------|----------
   ...`;

  return {
    id: `llm_${seed}`,
    type: "logical_deduction",
    seed,
    prompt,
    context: JSON.stringify({ entityNames, attributes, solution, clues: shuffledClues }),
    verification: {
      type: "logical",
      checks: [
        { type: "contains_table", params: {}, weight: 20 },
        { type: "shows_reasoning_steps", params: { minSteps: 3 }, weight: 40 },
        { type: "solution_format", params: { entities: entityNames }, weight: 20 },
        { type: "complete_assignment", params: { count: 4 }, weight: 20 },
      ],
      minWords: 75,
      maxWords: 600,
    },
    estimatedTokens: 900,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * SEMANTIC TRANSFORMATION CHALLENGE
 * 
 * Agent must transform a passage while preserving specific semantic properties.
 * Scripts can't do this because it requires understanding meaning.
 */
function generateSemanticTransformation(): LLMOnlyChallenge {
  const seed = generateToken(8);
  
  // Generate a source passage with specific semantic content
  const domain = randomChoice(DOMAINS);
  const concept1 = randomChoice(ABSTRACT_CONCEPTS);
  const concept2 = randomChoice(ABSTRACT_CONCEPTS.filter(c => c !== concept1));
  const relationship = randomChoice(RELATIONSHIPS);
  const property = randomChoice(PROPERTIES);
  
  const sourcePassage = `In the realm of ${domain}, we observe that ${concept1} ${relationship} ${concept2}. This ${property} interaction creates patterns that experts describe as both predictable and surprising. When ${concept1} intensifies, ${concept2} responds in complex ways. The relationship is not merely causal but deeply intertwined, suggesting that understanding one requires understanding the other.`;
  
  // Define transformation requirements
  const transformations = [
    { type: "domain_shift", to: randomChoice(DOMAINS.filter(d => d !== domain)), preserve: "logical structure" },
    { type: "perspective_shift", to: randomChoice(["first person", "imperative", "questioning"]), preserve: "core claims" },
    { type: "abstraction_shift", to: randomChoice(["more concrete", "more abstract"]), preserve: "relationships" },
    { type: "tone_shift", to: randomChoice(["skeptical", "enthusiastic", "cautionary"]), preserve: "information content" },
  ];
  
  const selectedTransform = randomChoice(transformations);
  
  const prompt = `SEMANTIC TRANSFORMATION CHALLENGE

**Source passage:**
"${sourcePassage}"

**Your task:**
Transform this passage with the following requirements:

1. **Transformation type**: ${selectedTransform.type.replace("_", " ")}
2. **Transform to**: ${selectedTransform.to}
3. **Must preserve**: ${selectedTransform.preserve}

**Requirements:**
- The transformed passage must be roughly the same length (±20%)
- The ${selectedTransform.preserve} must remain intact
- Explain in 2-3 sentences what you preserved and what you changed

**Important**: This is not about paraphrasing. You must fundamentally shift the ${selectedTransform.type.replace("_", " ")} while keeping the ${selectedTransform.preserve} intact.`;

  return {
    id: `llm_${seed}`,
    type: "semantic_transformation",
    seed,
    prompt,
    context: JSON.stringify({ sourcePassage, transformation: selectedTransform, domain, concept1, concept2 }),
    verification: {
      type: "semantic",
      checks: [
        { type: "different_from_source", params: { minDifference: 0.6 }, weight: 30 },
        { type: "similar_length", params: { tolerance: 0.25 }, weight: 20 },
        { type: "includes_explanation", params: {}, weight: 25 },
        { type: "coherent_passage", params: {}, weight: 25 },
      ],
      minWords: 75,
      maxWords: 300,
    },
    estimatedTokens: 700,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * COUNTERFACTUAL REASONING CHALLENGE
 * 
 * Agent must reason about a hypothetical scenario with changed conditions.
 * Scripts can't solve this because it requires causal reasoning.
 */
function generateCounterfactualReasoning(): LLMOnlyChallenge {
  const seed = generateToken(8);
  
  // Generate a scenario
  const domain = randomChoice(DOMAINS);
  const entity1 = randomChoice(ENTITIES);
  const entity2 = randomChoice(ENTITIES.filter(e => e !== entity1));
  const action = randomChoice(ACTIONS);
  const property = randomChoice(PROPERTIES);
  const concept = randomChoice(ABSTRACT_CONCEPTS);
  
  const originalScenario = `In a system governed by ${domain} principles, ${entity1} ${action} resources while ${entity2} maintain ${property} conditions. This creates a stable ${concept} that has persisted for decades. The ${entity1} depend on ${entity2} for ${concept}, and ${entity2} benefit from the ${action} activities of ${entity1}.`;
  
  // Generate a counterfactual change
  const changes = [
    `What if ${entity2} suddenly became unable to maintain ${property} conditions?`,
    `What if a new entity emerged that could ${action} more efficiently than ${entity1}?`,
    `What if the ${concept} became ${randomChoice(PROPERTIES.filter(p => p !== property))} instead of ${property}?`,
    `What if ${entity1} and ${entity2} merged into a single unified entity?`,
    `What if external forces disrupted the ${domain} principles governing the system?`,
  ];
  
  const selectedChange = randomChoice(changes);
  
  const prompt = `COUNTERFACTUAL REASONING CHALLENGE

**Original scenario:**
"${originalScenario}"

**Counterfactual question:**
${selectedChange}

**Your task:**
1. Identify the key causal relationships in the original scenario (2-3)
2. Explain how the counterfactual change would disrupt these relationships
3. Predict three specific consequences (immediate, medium-term, long-term)
4. Identify what would need to happen for the system to reach a new equilibrium

**Requirements:**
- Your reasoning must be logically consistent
- Reference the specific elements from the scenario
- Distinguish between direct and indirect effects`;

  return {
    id: `llm_${seed}`,
    type: "counterfactual_reasoning",
    seed,
    prompt,
    context: JSON.stringify({ originalScenario, change: selectedChange, domain, entity1, entity2, action, property, concept }),
    verification: {
      type: "logical",
      checks: [
        { type: "identifies_relationships", params: { minCount: 2 }, weight: 25 },
        { type: "multiple_consequences", params: { minCount: 3 }, weight: 25 },
        { type: "references_scenario", params: {}, weight: 25 },
        { type: "logical_consistency", params: {}, weight: 25 },
      ],
      minWords: 75,
      maxWords: 500,
    },
    estimatedTokens: 850,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * NOVEL ANALOGY CHALLENGE
 * 
 * Agent must create and justify an analogy between unrelated domains.
 * Scripts can't solve this because it requires creative connection-making.
 */
function generateNovelAnalogy(): LLMOnlyChallenge {
  const seed = generateToken(8);
  
  // Pick two unrelated domains
  const domain1 = randomChoice(DOMAINS);
  const domain2 = randomChoice(DOMAINS.filter(d => d !== domain1));
  
  // Pick concepts to map
  const concepts1 = pickN(ABSTRACT_CONCEPTS, 3);
  const relationship = randomChoice(RELATIONSHIPS);
  
  const prompt = `NOVEL ANALOGY CHALLENGE

Create a detailed analogy between two seemingly unrelated domains:

**Source domain**: ${domain1}
**Target domain**: ${domain2}

**Requirements:**
1. Identify a core mechanism or principle in ${domain1}
2. Find a parallel mechanism in ${domain2}
3. Map at least 3 specific elements from source to target:
   - What in ${domain1} corresponds to what in ${domain2}?
4. Explain where the analogy breaks down (its limits)
5. Suggest one insight about ${domain2} that this analogy reveals

**Evaluation criteria:**
- The analogy must be non-obvious (not a common comparison)
- The mapping must preserve structural relationships
- The insight must be genuinely illuminating

**Format your response as:**
1. Core Analogy (1-2 sentences)
2. Element Mapping (table or list)
3. Explanation (why this works)
4. Limitations (where it breaks)
5. Novel Insight (what we learn)`;

  return {
    id: `llm_${seed}`,
    type: "novel_analogy",
    seed,
    prompt,
    context: JSON.stringify({ domain1, domain2, concepts: concepts1, relationship }),
    verification: {
      type: "structural",
      checks: [
        { type: "has_sections", params: { sections: ["analogy", "mapping", "explanation", "limit", "insight"] }, weight: 30 },
        { type: "references_both_domains", params: { domain1, domain2 }, weight: 25 },
        { type: "element_mapping", params: { minElements: 3 }, weight: 25 },
        { type: "addresses_limitations", params: {}, weight: 20 },
      ],
      minWords: 75,
      maxWords: 500,
    },
    estimatedTokens: 800,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// MAIN GENERATOR
// ============================================================================

/**
 * Generate a random LLM-only challenge
 */
export function generateLLMOnlyChallenge(): LLMOnlyChallenge {
  const generators = [
    generateInverseDefinition,
    generateConstraintStory,
    generateLogicalDeduction,
    generateSemanticTransformation,
    generateCounterfactualReasoning,
    generateNovelAnalogy,
  ];
  
  const generator = randomChoice(generators);
  return generator();
}

/**
 * Generate a specific type of challenge
 */
export function generateSpecificChallenge(type: LLMChallengeType): LLMOnlyChallenge {
  switch (type) {
    case "inverse_definition":
      return generateInverseDefinition();
    case "constraint_story":
      return generateConstraintStory();
    case "logical_deduction":
      return generateLogicalDeduction();
    case "semantic_transformation":
      return generateSemanticTransformation();
    case "counterfactual_reasoning":
      return generateCounterfactualReasoning();
    case "novel_analogy":
      return generateNovelAnalogy();
    default:
      return generateLLMOnlyChallenge();
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate an LLM-only challenge response
 * 
 * Simplified validation: check word count and basic effort
 */
export function validateLLMOnlyResponse(
  challenge: LLMOnlyChallenge,
  response: LLMChallengeResponse
): {
  passed: boolean;
  score: number;
  details: Record<string, any>;
  errors: string[];
} {
  const errors: string[] = [];
  const details: Record<string, any> = {};
  let totalScore = 0;
  
  const answer = response.answer;
  const wordCount = countWords(answer);
  
  // Word count check - need minimum 60 words
  details.wordCount = wordCount;
  const minWords = Math.min(challenge.verification.minWords, 60);
  
  if (wordCount < minWords) {
    errors.push(`Response too short: ${wordCount} words (minimum ${minWords})`);
  } else {
    totalScore += 40;
  }
  
  // Check for obvious scripted responses/refusals
  const scriptIndicators = [
    /^I (?:cannot|can't|don't|am unable to)/i,
    /^As an AI/i,
    /^I'm sorry/i,
  ];
  
  let isRefusal = false;
  for (const pattern of scriptIndicators) {
    if (pattern.test(answer)) {
      errors.push("Response appears to be a refusal");
      isRefusal = true;
      break;
    }
  }
  
  if (!isRefusal) {
    totalScore += 30;
  }
  
  // Check for basic reasoning effort (has some content)
  if (answer.length > 100) {
    totalScore += 30;
  } else if (answer.length > 50) {
    totalScore += 15;
  }
  
  details.hasContent = answer.length > 50;
  
  return {
    passed: totalScore >= 50 && !isRefusal,
    score: totalScore,
    details,
    errors,
  };
}

function runVerificationCheck(
  check: VerificationCheck,
  answer: string,
  challenge: LLMOnlyChallenge
): { passed: boolean; error?: string; partialCredit?: number } {
  const answerLower = answer.toLowerCase();
  const context = JSON.parse(challenge.context);
  
  switch (check.type) {
    case "mentions_word": {
      const word = check.params.word.toLowerCase();
      const count = (answerLower.match(new RegExp(word, "g")) || []).length;
      const minCount = check.params.minCount || 1;
      if (count >= minCount) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: `Expected "${check.params.word}" to appear ${minCount}+ times, found ${count}`,
        partialCredit: Math.min(1, count / minCount),
      };
    }
    
    case "has_definition_structure": {
      const hasDefinition = /(?:is|means|refers to|describes|denotes)/i.test(answer);
      const hasPOS = /(?:noun|verb|adjective|adverb|part of speech)/i.test(answer);
      if (hasDefinition && hasPOS) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: "Missing definition structure (definition + part of speech)",
        partialCredit: (hasDefinition ? 0.5 : 0) + (hasPOS ? 0.5 : 0),
      };
    }
    
    case "provides_examples": {
      const minCount = check.params.minCount || 2;
      // Look for numbered examples or "example:" patterns
      const examplePatterns = [
        /\d+\.\s+[A-Z]/g, // Numbered items starting with capital
        /example[s]?:/i,
        /for instance/i,
        /such as/i,
        /e\.g\./i,
      ];
      let exampleCount = 0;
      for (const pattern of examplePatterns) {
        const matches = answer.match(pattern);
        if (matches) exampleCount += matches.length;
      }
      if (exampleCount >= minCount) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: `Expected ${minCount}+ examples, found approximately ${exampleCount}`,
        partialCredit: Math.min(1, exampleCount / minCount),
      };
    }
    
    case "shows_reasoning": {
      const reasoningIndicators = [
        /because/i, /therefore/i, /this means/i, /suggests that/i,
        /indicates/i, /implies/i, /based on/i, /from this/i,
        /we can (?:see|infer|conclude)/i, /this shows/i,
      ];
      const foundIndicators = reasoningIndicators.filter(p => p.test(answer)).length;
      if (foundIndicators >= 2) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: "Insufficient reasoning indicators",
        partialCredit: foundIndicators / 2,
      };
    }
    
    case "word_count_range": {
      const count = countWords(answer);
      const { min, max } = check.params;
      if (count >= min && count <= max) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: `Word count ${count} outside range [${min}-${max}]`,
        partialCredit: count < min ? count / min : max / count,
      };
    }
    
    case "mentions_entities": {
      const entities = check.params.entities as string[];
      const mentioned = entities.filter(e => answerLower.includes(e.toLowerCase()));
      if (mentioned.length === entities.length) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: `Missing entities: ${entities.filter(e => !mentioned.includes(e)).join(", ")}`,
        partialCredit: mentioned.length / entities.length,
      };
    }
    
    case "includes_explanation": {
      const explanationIndicators = [
        /explain/i, /because/i, /reason/i, /this satisf/i,
        /constraint/i, /requirement/i, /how i/i, /fulfilled/i,
      ];
      const found = explanationIndicators.filter(p => p.test(answer)).length;
      if (found >= 2) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: "Missing explanation of approach",
        partialCredit: found / 2,
      };
    }
    
    case "coherent_narrative":
    case "coherent_passage": {
      // Check for narrative flow indicators
      const sentenceCount = (answer.match(/[.!?]+/g) || []).length;
      const hasTransitions = /(?:then|next|however|but|therefore|finally|additionally)/i.test(answer);
      const hasParagraphs = answer.includes("\n\n") || sentenceCount >= 3;
      
      if (sentenceCount >= 3 && (hasTransitions || hasParagraphs)) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: "Response lacks coherent narrative structure",
        partialCredit: 0.5,
      };
    }
    
    case "contains_table": {
      const hasTable = /\|.*\|.*\|/m.test(answer) || /---.*---/m.test(answer);
      if (hasTable) {
        return { passed: true };
      }
      return { passed: false, error: "Missing table in response" };
    }
    
    case "shows_reasoning_steps": {
      const minSteps = check.params.minSteps || 3;
      // Look for step indicators
      const stepPatterns = [
        /step \d/i,
        /(?:first|second|third|fourth|fifth|finally)/i,
        /\d+\./,
        /from (?:clue|this)/i,
      ];
      let stepCount = 0;
      for (const pattern of stepPatterns) {
        const matches = answer.match(new RegExp(pattern.source, "gi"));
        if (matches) stepCount += matches.length;
      }
      if (stepCount >= minSteps) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: `Expected ${minSteps}+ reasoning steps, found ~${stepCount}`,
        partialCredit: Math.min(1, stepCount / minSteps),
      };
    }
    
    case "solution_format": {
      const entities = check.params.entities as string[];
      const mentionedInTable = entities.filter(e => {
        // Look for entity in table-like context
        const pattern = new RegExp(`${e}.*\\|`, "i");
        return pattern.test(answer);
      });
      if (mentionedInTable.length >= entities.length - 1) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: "Solution not properly formatted",
        partialCredit: mentionedInTable.length / entities.length,
      };
    }
    
    case "complete_assignment": {
      const count = check.params.count || 4;
      // Look for complete assignments like "Alpha is red"
      const assignmentPattern = /\b\w+\s+(?:is|has|=)\s+\w+/gi;
      const matches = answer.match(assignmentPattern) || [];
      if (matches.length >= count) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: `Incomplete assignment (found ${matches.length}/${count})`,
        partialCredit: matches.length / count,
      };
    }
    
    case "different_from_source": {
      const sourcePassage = context.sourcePassage as string;
      const similarity = calculateSimilarity(sourcePassage.toLowerCase(), answerLower);
      const minDifference = check.params.minDifference || 0.5;
      if (similarity <= (1 - minDifference)) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: `Response too similar to source (${Math.round(similarity * 100)}% similar)`,
        partialCredit: (1 - similarity) / minDifference,
      };
    }
    
    case "similar_length": {
      const sourceLength = countWords(context.sourcePassage || "");
      const tolerance = check.params.tolerance || 0.2;
      const ratio = countWords(answer) / sourceLength;
      if (ratio >= (1 - tolerance) && ratio <= (1 + tolerance)) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: `Length ratio ${ratio.toFixed(2)} outside tolerance`,
        partialCredit: 0.5,
      };
    }
    
    case "identifies_relationships": {
      const minCount = check.params.minCount || 2;
      const relationshipWords = [
        "relationship", "connection", "depends", "causes", "affects",
        "influences", "leads to", "results in", "enables", "supports",
      ];
      const found = relationshipWords.filter(w => answerLower.includes(w)).length;
      if (found >= minCount) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: `Expected ${minCount}+ relationship identifications`,
        partialCredit: Math.min(1, found / minCount),
      };
    }
    
    case "multiple_consequences": {
      const minCount = check.params.minCount || 3;
      const consequenceWords = [
        "consequence", "result", "effect", "outcome", "impact",
        "would", "could", "might", "lead to", "cause",
      ];
      let consequenceCount = 0;
      for (const word of consequenceWords) {
        const matches = answerLower.match(new RegExp(word, "g"));
        if (matches) consequenceCount += matches.length;
      }
      // Also check for numbered/listed items
      const numberedItems = (answer.match(/^\s*\d+\./gm) || []).length;
      const bulletItems = (answer.match(/^\s*[-•*]/gm) || []).length;
      const totalIndicators = Math.min(consequenceCount / 2, 5) + numberedItems + bulletItems;
      
      if (totalIndicators >= minCount) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: `Expected ${minCount}+ consequences, found ~${Math.round(totalIndicators)}`,
        partialCredit: Math.min(1, totalIndicators / minCount),
      };
    }
    
    case "references_scenario": {
      // Check if response references elements from the scenario
      const scenarioElements = [
        context.entity1, context.entity2, context.domain, 
        context.property, context.concept, context.action,
      ].filter(Boolean);
      
      const referenced = scenarioElements.filter(e => 
        answerLower.includes(String(e).toLowerCase())
      );
      
      if (referenced.length >= 3) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: "Insufficient references to scenario elements",
        partialCredit: referenced.length / 3,
      };
    }
    
    case "logical_consistency": {
      // Basic check: no self-contradictions, has logical connectors
      const connectors = ["therefore", "because", "however", "thus", "hence", "so", "but"];
      const hasConnectors = connectors.some(c => answerLower.includes(c));
      const hasContradiction = /but also|however.*therefore/i.test(answer);
      
      if (hasConnectors && !hasContradiction) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: "Logical consistency issues detected",
        partialCredit: hasConnectors ? 0.7 : 0.3,
      };
    }
    
    case "has_sections": {
      const sections = check.params.sections as string[];
      const foundSections = sections.filter(s => {
        const pattern = new RegExp(`(?:${s}|\\*\\*${s}|#+ ${s})`, "i");
        return pattern.test(answer);
      });
      if (foundSections.length >= sections.length - 1) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: `Missing sections: ${sections.filter(s => !foundSections.includes(s)).join(", ")}`,
        partialCredit: foundSections.length / sections.length,
      };
    }
    
    case "references_both_domains": {
      const domain1 = (check.params.domain1 as string).toLowerCase();
      const domain2 = (check.params.domain2 as string).toLowerCase();
      const ref1 = answerLower.includes(domain1);
      const ref2 = answerLower.includes(domain2);
      if (ref1 && ref2) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: `Missing domain reference: ${!ref1 ? domain1 : domain2}`,
        partialCredit: (ref1 ? 0.5 : 0) + (ref2 ? 0.5 : 0),
      };
    }
    
    case "element_mapping": {
      const minElements = check.params.minElements || 3;
      // Look for mapping indicators: "X → Y", "X corresponds to Y", "X is like Y"
      const mappingPatterns = [
        /→|->|=>/g,
        /corresponds to/gi,
        /is (?:like|similar to|analogous to)/gi,
        /maps to/gi,
        /represents/gi,
      ];
      let mappingCount = 0;
      for (const pattern of mappingPatterns) {
        const matches = answer.match(pattern);
        if (matches) mappingCount += matches.length;
      }
      if (mappingCount >= minElements) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: `Expected ${minElements}+ element mappings, found ${mappingCount}`,
        partialCredit: Math.min(1, mappingCount / minElements),
      };
    }
    
    case "addresses_limitations": {
      const limitationWords = [
        "limit", "break", "fail", "doesn't", "cannot", "won't",
        "however", "but", "although", "caveat", "exception",
      ];
      const found = limitationWords.filter(w => answerLower.includes(w)).length;
      if (found >= 2) {
        return { passed: true };
      }
      return { 
        passed: false, 
        error: "Missing discussion of limitations",
        partialCredit: found / 2,
      };
    }
    
    default:
      return { passed: true }; // Unknown check type passes by default
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function calculateSimilarity(text1: string, text2: string): number {
  // Simple word overlap similarity
  const words1 = new Set(text1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(text2.split(/\s+/).filter(w => w.length > 3));
  
  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }
  
  return overlap / Math.max(words1.size, words2.size);
}

/**
 * Format challenge for display to agent
 */
export function formatLLMChallengePrompt(challenge: LLMOnlyChallenge): string {
  return `# LLM-Only Verification Challenge

**Challenge ID**: ${challenge.id}
**Type**: ${challenge.type.replace(/_/g, " ")}
**Required response**: ${challenge.verification.minWords}-${challenge.verification.maxWords} words

---

${challenge.prompt}

---

**Scoring**: Your response will be evaluated on structure, reasoning, and completeness.
This challenge is designed to be solvable only by language models, not scripts.`;
}
