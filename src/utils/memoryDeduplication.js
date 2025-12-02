/**
 * Memory Deduplication Utility
 * 
 * Detects and handles near-duplicate memories based on semantic similarity.
 * Uses a simple but effective string similarity algorithm.
 */

/**
 * Calculate similarity between two strings using a simple fuzzy match
 * Returns a score between 0 and 1
 */
function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  // Exact match
  if (s1 === s2) return 1.0;
  
  // Calculate Levenshtein distance
  const matrix = [];
  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  const distance = matrix[s2.length][s1.length];
  const maxLength = Math.max(s1.length, s2.length);
  
  return 1 - (distance / maxLength);
}

/**
 * Check if two memories are semantically similar
 */
function areMemoriesSimilar(memory1, memory2, threshold = 0.75) {
  // Compare summaries first (most important)
  const summaryScore = calculateSimilarity(
    memory1.summary || '',
    memory2.summary || ''
  );
  
  // If summaries are very similar, it's likely a duplicate
  if (summaryScore >= threshold) {
    return { similar: true, score: summaryScore, reason: 'summary' };
  }
  
  // Compare content
  const contentScore = calculateSimilarity(
    memory1.content || '',
    memory2.content || ''
  );
  
  if (contentScore >= threshold) {
    return { similar: true, score: contentScore, reason: 'content' };
  }
  
  // Check for high overlap in both summary and content (lower threshold)
  const avgScore = (summaryScore + contentScore) / 2;
  if (avgScore >= 0.65) {
    return { similar: true, score: avgScore, reason: 'combined' };
  }
  
  return { similar: false, score: Math.max(summaryScore, contentScore) };
}

/**
 * Merge two similar memories into one
 * Keeps the more detailed content and combines metadata
 */
function mergeMemories(memory1, memory2) {
  // Choose the memory with more detailed content
  const primary = memory1.content.length >= memory2.content.length ? memory1 : memory2;
  const secondary = memory1.content.length >= memory2.content.length ? memory2 : memory1;
  
  return {
    ...primary,
    // Combine domains and emotions (unique)
    domains: [...new Set([...(primary.domains || []), ...(secondary.domains || [])])],
    emotions: [...new Set([...(primary.emotions || []), ...(secondary.emotions || [])])],
    // Take higher intensity
    intensity: Math.max(primary.intensity || 0, secondary.intensity || 0),
    // Track that this was merged
    merged_from: [
      ...(primary.merged_from || []),
      ...(secondary.merged_from || []),
      secondary.id
    ],
    // Keep earliest created date
    created: primary.created < secondary.created ? primary.created : secondary.created,
  };
}

/**
 * Main deduplication function
 * 
 * @param {Array} memories - Array of memory objects
 * @param {Object} options - Configuration options
 * @returns {Object} - { deduplicated, duplicates, stats }
 */
export function deduplicateMemories(memories, options = {}) {
  const {
    similarityThreshold = 0.75,  // How similar memories need to be to merge
    autoMerge = false,            // Automatically merge or return for review
  } = options;
  
  const deduplicated = [];
  const duplicates = [];
  const mergeMap = new Map(); // Track which memories should be merged
  
  for (let i = 0; i < memories.length; i++) {
    const current = memories[i];
    let foundDuplicate = false;
    
    // Check against already deduplicated memories
    for (let j = 0; j < deduplicated.length; j++) {
      const comparison = areMemoriesSimilar(
        current,
        deduplicated[j],
        similarityThreshold
      );
      
      if (comparison.similar) {
        foundDuplicate = true;
        
        // Track this duplicate
        duplicates.push({
          memory: current,
          similarTo: deduplicated[j],
          score: comparison.score,
          reason: comparison.reason,
        });
        
        // If auto-merge is enabled, merge them
        if (autoMerge) {
          deduplicated[j] = mergeMemories(deduplicated[j], current);
        }
        
        break;
      }
    }
    
    // If no duplicate found, add to deduplicated list
    if (!foundDuplicate) {
      deduplicated.push(current);
    }
  }
  
  const stats = {
    original: memories.length,
    deduplicated: deduplicated.length,
    duplicatesFound: duplicates.length,
    reduction: memories.length > 0 
      ? ((duplicates.length / memories.length) * 100).toFixed(1) + '%'
      : '0%',
  };
  
  return {
    deduplicated,
    duplicates,
    stats,
  };
}

/**
 * Find all pairs of similar memories
 * Useful for review UI
 */
export function findDuplicatePairs(memories, threshold = 0.75) {
  const pairs = [];
  
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const comparison = areMemoriesSimilar(memories[i], memories[j], threshold);
      
      if (comparison.similar) {
        pairs.push({
          memory1: memories[i],
          memory2: memories[j],
          score: comparison.score,
          reason: comparison.reason,
        });
      }
    }
  }
  
  return pairs.sort((a, b) => b.score - a.score);
}
