# User Moderation Features

This document explains how to use the user moderation features implemented in the project.

## Overview

The user moderation system integrates with the MBD API to analyze Farcaster users and detect potentially problematic content or behavior. The system provides:

- User-based moderation (analyzes user accounts rather than individual content)
- Caching for efficient API usage
- Ready-to-use flags based on configurable thresholds
- Batch processing for analyzing multiple users at once
- API endpoints for integration with your front-end

## API Endpoints

### Single User Moderation

```
GET /api/user-moderation?fid=<farcaster_id>
```

Returns raw moderation data for a single user.

### Batch User Moderation

```
POST /api/user-moderation/batch
```

Body:
```json
{
  "fids": ["1", "2", "3"],
  "skipCache": false
}
```

Returns raw moderation data for multiple users in a single API call.

### User Moderation Flags

```
GET /api/user-flags?fid=<farcaster_id>&spam=0.5&ai_generated=0.6
```

Returns moderation data with boolean flags indicating if the user exceeds specified thresholds. You can customize thresholds via query parameters.

## Programmatic Usage

### Basic Usage

```typescript
import { getUserModeration } from '@/lib/mbd';

// Get moderation data for a single user
const userId = '123456';
const result = await getUserModeration([userId]);
console.log(result[userId].moderation);
```

### With Flags

```typescript
import { getModerationFlags, checkUserModeration } from '@/lib/moderation';

// Check if a user exceeds default thresholds
const userFlags = await checkUserModeration('123456');
if (userFlags?.flags.isFlagged) {
  console.log('User has been flagged for moderation');
}

// Check multiple users with custom thresholds
const customThresholds = {
  spam: 0.5,
  ai_generated: 0.6
};
const results = await getModerationFlags(['123', '456'], customThresholds);
```

## Caching

Moderation results are cached in memory for 1 hour by default. To bypass the cache:

```typescript
// Skip cache for fresh results
const freshResults = await getUserModeration([userId], true);
```

## Available Moderation Indicators

The MBD API provides the following moderation indicators:

- `spam_probability`: Likelihood the user posts spam content
- `ai_generated_probability`: Likelihood the user posts AI-generated content
- `sexual`: Sexual content
- `hate`: Hate speech
- `violence`: Violent content
- `harassment`: Harassment
- `selfharm`: Self-harm content
- `sexual_minors`: Sexual content involving minors
- `hate_threatening`: Threatening hate speech
- `violence_graphic`: Graphic violence

## Default Thresholds

The system uses the following default thresholds for flagging content:

```typescript
export const DEFAULT_MODERATION_THRESHOLDS = {
  spam: 0.7,
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
```

You can customize these thresholds when calling the API or using the library functions. 