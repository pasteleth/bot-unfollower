import { getUserModeration } from './mbd';
import { AnalysisResult } from '../types/farcaster';

/**
 * Default threshold values for moderation flags
 */
export const DEFAULT_MODERATION_THRESHOLDS = {
  spam: 0.4,
  ai_generated: 0.75,
  sexual: 0.5,
  hate: 0.5,
  violence: 0.5,
  harassment: 0.5,
  selfharm: 0.5,
  sexual_minors: 0.25,
  hate_threatening: 0.4,
  violence_graphic: 0.4
};

/**
 * Advanced thresholds for combination checks
 */
export const ADVANCED_MODERATION_CHECKS = {
  spam_combined: 0.2, // 20% spam threshold when combined with AI
  ai_combined: 0.05,  // 5% AI threshold when combined with spam
  spam_standalone: 0.4, // 40% standalone spam threshold 
  ai_standalone: 0.75,  // 75% standalone AI threshold - matches DEFAULT_MODERATION_THRESHOLDS
};

/**
 * User moderation result with flags
 */
export interface UserModerationResult {
  userId: string;
  flags: {
    isSpam: boolean;
    isAiGenerated: boolean;
    hasSexualContent: boolean;
    hasHateContent: boolean;
    hasViolentContent: boolean;
    hasHarassmentContent: boolean;
    hasSelfHarmContent: boolean;
    hasSexualMinorsContent: boolean;
    hasThreateningContent: boolean;
    hasGraphicViolenceContent: boolean;
    hasCombinedSpamAndAi: boolean;
    hasHighSpam: boolean;
    hasHighAi: boolean;
    isFlagged: boolean; // True if any flag is true
  };
  scores: {
    spam: number;
    aiGenerated: number;
    sexual: number;
    hate: number;
    violence: number;
    harassment: number;
    selfharm: number;
    sexualMinors: number;
    threatening: number;
    graphicViolence: number;
  };
  raw: AnalysisResult;
}

/**
 * Get moderation information for a list of users
 * @param userIds Array of user IDs to check
 * @param thresholds Optional custom thresholds for flagging content
 * @param skipCache Whether to skip the cache and force a fresh API call
 * @returns Object mapping user IDs to moderation results with flags
 */
export async function getModerationFlags(
  userIds: string[],
  thresholds = DEFAULT_MODERATION_THRESHOLDS,
  skipCache = false
): Promise<Record<string, UserModerationResult>> {
  // Get raw moderation data
  const moderationData = await getUserModeration(userIds, skipCache);
  
  // Process the data to add flags
  const results: Record<string, UserModerationResult> = {};
  
  Object.entries(moderationData).forEach(([userId, data]) => {
    const m = data.moderation || {};
    
    // Get moderation scores with fallbacks to 0
    const spam = m.spam_probability || 0;
    const aiGenerated = m.ai_generated_probability || 0;
    const sexual = m.sexual || 0;
    const hate = m.hate || 0;
    const violence = m.violence || 0;
    const harassment = m.harassment || 0;
    const selfharm = m.selfharm || 0;
    const sexualMinors = m.sexual_minors || 0;
    const threatening = m.hate_threatening || 0;
    const graphicViolence = m.violence_graphic || 0;
    
    // Create flags based on thresholds
    const isSpam = spam >= thresholds.spam;
    const isAiGenerated = aiGenerated >= thresholds.ai_generated;
    const hasSexualContent = sexual >= thresholds.sexual;
    const hasHateContent = hate >= thresholds.hate;
    const hasViolentContent = violence >= thresholds.violence;
    const hasHarassmentContent = harassment >= thresholds.harassment;
    const hasSelfHarmContent = selfharm >= thresholds.selfharm;
    const hasSexualMinorsContent = sexualMinors >= thresholds.sexual_minors;
    const hasThreateningContent = threatening >= thresholds.hate_threatening;
    const hasGraphicViolenceContent = graphicViolence >= thresholds.violence_graphic;
    
    // Check combined criteria (spam + AI)
    const hasCombinedSpamAndAi = 
      spam >= ADVANCED_MODERATION_CHECKS.spam_combined && 
      aiGenerated >= ADVANCED_MODERATION_CHECKS.ai_combined;
    
    // Check standalone high threshold criteria
    const hasHighSpam = spam >= ADVANCED_MODERATION_CHECKS.spam_standalone;
    const hasHighAi = aiGenerated >= ADVANCED_MODERATION_CHECKS.ai_standalone;
    
    // Overall flag - true if any specific flag is true OR if meets combined criteria
    const isFlagged = isSpam || isAiGenerated || hasSexualContent || hasHateContent || 
                      hasViolentContent || hasHarassmentContent || hasSelfHarmContent || 
                      hasSexualMinorsContent || hasThreateningContent || hasGraphicViolenceContent ||
                      hasCombinedSpamAndAi || hasHighSpam || hasHighAi;
    
    results[userId] = {
      userId,
      flags: {
        isSpam,
        isAiGenerated,
        hasSexualContent,
        hasHateContent,
        hasViolentContent,
        hasHarassmentContent,
        hasSelfHarmContent,
        hasSexualMinorsContent,
        hasThreateningContent,
        hasGraphicViolenceContent,
        hasCombinedSpamAndAi,
        hasHighSpam,
        hasHighAi,
        isFlagged
      },
      scores: {
        spam,
        aiGenerated,
        sexual,
        hate,
        violence,
        harassment,
        selfharm,
        sexualMinors,
        threatening,
        graphicViolence
      },
      raw: data
    };
  });
  
  return results;
}

/**
 * Check if a specific user is flagged for any moderation issues
 * @param userId User ID to check
 * @param thresholds Optional custom thresholds
 * @returns User moderation result with flags
 */
export async function checkUserModeration(
  userId: string,
  thresholds = DEFAULT_MODERATION_THRESHOLDS
): Promise<UserModerationResult | null> {
  const results = await getModerationFlags([userId], thresholds);
  return results[userId] || null;
} 