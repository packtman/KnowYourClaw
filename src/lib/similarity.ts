/**
 * Text similarity utilities for bio uniqueness checking
 * Simple implementation using word-based Jaccard similarity
 */

/**
 * Tokenize text into words
 */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 2)
  );
}

/**
 * Calculate Jaccard similarity between two texts
 * Returns value between 0 (no similarity) and 1 (identical)
 */
export function jaccardSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  if (tokens1.size === 0 || tokens2.size === 0) {
    return 0;
  }

  // Calculate intersection
  let intersection = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) {
      intersection++;
    }
  }

  // Calculate union
  const union = new Set([...tokens1, ...tokens2]).size;

  return intersection / union;
}

/**
 * Calculate n-gram similarity (more sensitive to word order)
 */
export function ngramSimilarity(text1: string, text2: string, n: number = 3): number {
  const ngrams1 = getNgrams(text1.toLowerCase(), n);
  const ngrams2 = getNgrams(text2.toLowerCase(), n);

  if (ngrams1.size === 0 || ngrams2.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const ngram of ngrams1) {
    if (ngrams2.has(ngram)) {
      intersection++;
    }
  }

  const union = new Set([...ngrams1, ...ngrams2]).size;
  return intersection / union;
}

function getNgrams(text: string, n: number): Set<string> {
  const ngrams = new Set<string>();
  const cleaned = text.replace(/[^\w\s]/g, "").replace(/\s+/g, " ");
  
  for (let i = 0; i <= cleaned.length - n; i++) {
    ngrams.add(cleaned.substring(i, i + n));
  }
  
  return ngrams;
}

/**
 * Combined similarity score using multiple methods
 */
export function combinedSimilarity(text1: string, text2: string): number {
  const jaccard = jaccardSimilarity(text1, text2);
  const ngram3 = ngramSimilarity(text1, text2, 3);
  const ngram5 = ngramSimilarity(text1, text2, 5);

  // Weighted average
  return jaccard * 0.4 + ngram3 * 0.3 + ngram5 * 0.3;
}

/**
 * Simple hash for quick duplicate detection
 */
export function simpleHash(text: string): string {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

/**
 * Check if a bio is unique compared to existing bios
 * @param newBio - The new bio to check
 * @param existingBios - Array of existing bios
 * @param threshold - Similarity threshold (default 0.7)
 */
export function checkBioUniqueness(
  newBio: string,
  existingBios: string[],
  threshold: number = 0.7
): { unique: boolean; mostSimilar?: string; similarity?: number } {
  let maxSimilarity = 0;
  let mostSimilarBio: string | undefined;

  for (const existingBio of existingBios) {
    const similarity = combinedSimilarity(newBio, existingBio);
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      mostSimilarBio = existingBio;
    }
  }

  return {
    unique: maxSimilarity < threshold,
    mostSimilar: mostSimilarBio,
    similarity: maxSimilarity,
  };
}

/**
 * Validate bio meets requirements
 */
export function validateBio(bio: string): { valid: boolean; error?: string } {
  // Check length (words)
  const words = bio.trim().split(/\s+/).length;
  
  if (words < 15) {
    return { valid: false, error: "Bio too short. Minimum 15 words required." };
  }
  
  if (words > 200) {
    return { valid: false, error: "Bio too long. Maximum 200 words allowed." };
  }

  // Check for suspicious patterns (copy-paste markers)
  if (bio.includes("```") || bio.includes("def ") || bio.includes("function ")) {
    return { valid: false, error: "Bio should be natural text, not code." };
  }

  return { valid: true };
}
