/**
 * Type definition for a Farcaster user the authenticated user is following
 */
export type Following = {
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
  bio?: string;
};

/**
 * Type for the analysis result returned by MBD API
 */
export type AnalysisResult = {
  moderation?: {
    spam_probability?: number;
    ai_generated_probability?: number;
    [key: string]: number | undefined;
  };
};

/**
 * Type for a bot account
 */
export type BotAccount = Following & {
  botType: 'known' | 'spam' | 'ai';
  botScores: {
    known?: boolean;
    spam_probability?: number;
    ai_generated_probability?: number;
    error?: boolean;
    errorInfo?: string;
    [key: string]: boolean | number | string | undefined;
  };
};

/**
 * Type for bot statistics
 */
export type BotStats = {
  knownBots: number;
  aiContentBots: number;
  spamBots: number;
}; 