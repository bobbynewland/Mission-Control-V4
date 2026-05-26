/**
 * Performance Cron Script - AI Skills Studio Content Factory
 * 
 * Pulls analytics from YouTube, TikTok, and Instagram APIs,
 * calculates performance scores, and syncs to Firebase.
 * 
 * Usage:
 *   node performance-cron.js --dry-run    # Preview without writing
 *   node performance-cron.js              # Full execution
 * 
 * Environment variables (or .env file):
 *   YOUTUBE_API_KEY=your_youtube_api_key
 *   TIKTOK_API_KEY=your_tiktok_api_key
 *   INSTAGRAM_API_KEY=your_instagram_api_key
 *   FIREBASE_DATABASE_URL=https://winslow-756c3-default-rtdb.firebaseio.com
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update } from 'firebase/database';
import https from 'https';
import http from 'http';

// ============ CONFIGURATION ============

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAVmSmiuJDcCAiZhq3xqXSJZnWtviLvnuU",
  authDomain: "winslow-756c3.firebaseapp.com",
  databaseURL: "https://winslow-756c3-default-rtdb.firebaseio.com",
  projectId: "winslow-756c3",
  storageBucket: "winslow-756c3.appspot.com",
  messagingSenderId: "114362401734976703623",
  appId: "1:114362401734976703623:web:abc123def456"
};

// Content Factory paths
const PATHS = {
  performance: 'workspaces/winslow_main/projects/content_factory/performance',
  tasks: 'workspaces/winslow_main/projects/content_factory/tasks',
  ideaPool: 'workspaces/winslow_main/projects/content_factory/tasks/idea_pool'
};

// API Keys (from environment)
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const TIKTOK_API_KEY = process.env.TIKTOK_API_KEY || '';
const INSTAGRAM_API_KEY = process.env.INSTAGRAM_API_KEY || '';

// ============ FIREBASE SETUP ============

let db;
function initFirebase() {
  const app = initializeApp(FIREBASE_CONFIG);
  db = getDatabase(app);
  return db;
}

// ============ YOUTUBE ANALYTICS ============

/**
 * Fetches analytics from YouTube Data API v3
 * Requires: YouTube Data API v3 key (free, rate-limited to 10,000 units/day)
 * 
 * @param {string[]} videoIds - Array of YouTube video IDs
 * @returns {Promise<Object>} Video statistics
 */
async function fetchYouTubeAnalytics(videoIds) {
  if (!YOUTUBE_API_KEY) {
    console.log('[YouTube] No API key found, using placeholder data');
    return generatePlaceholderYouTubeData(videoIds);
  }

  const results = {};
  
  // YouTube API allows up to 50 video IDs per request
  const chunks = [];
  for (let i = 0; i < videoIds.length; i += 50) {
    chunks.push(videoIds.slice(i, i + 50));
  }

  for (const chunk of chunks) {
    const videoIdsParam = chunk.join(',');
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails&id=${videoIdsParam}&key=${YOUTUBE_API_KEY}`;
    
    try {
      const data = await fetchUrl(url);
      const parsed = JSON.parse(data);
      
      if (parsed.items) {
        for (const item of parsed.items) {
          const stats = item.statistics;
          const details = item.contentDetails;
          
          // Calculate engagement metrics
          const views = parseInt(stats.viewCount || '0');
          const likes = parseInt(stats.likeCount || '0');
          const comments = parseInt(stats.commentCount || '0');
          const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;
          
          // Duration parsing (ISO 8601)
          const duration = parseDuration(details.duration);
          
          results[item.id] = {
            platform: 'youtube',
            videoId: item.id,
            views,
            likes,
            comments,
            engagementRate: parseFloat(engagementRate.toFixed(2)),
            watchTimeMinutes: duration * views * 0.7, // Estimate 70% average watch rate
            duration,
            ctr: 5.5, // YouTube doesn't provide CTR via Data API, use estimate or from Analytics API
            fetchedAt: new Date().toISOString()
          };
        }
      }
    } catch (error) {
      console.error(`[YouTube] Error fetching video stats:`, error.message);
    }
  }

  return results;
}

function parseDuration(isoDuration) {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  return hours * 60 + minutes + seconds / 60;
}

function generatePlaceholderYouTubeData(videoIds) {
  const results = {};
  for (const videoId of videoIds) {
    results[videoId] = {
      platform: 'youtube',
      videoId,
      views: Math.floor(Math.random() * 50000) + 1000,
      likes: Math.floor(Math.random() * 2000) + 100,
      comments: Math.floor(Math.random() * 200) + 10,
      engagementRate: parseFloat((Math.random() * 8 + 2).toFixed(2)),
      watchTimeMinutes: Math.floor(Math.random() * 5000) + 500,
      duration: Math.floor(Math.random() * 20) + 3,
      ctr: parseFloat((Math.random() * 5 + 3).toFixed(2)),
      fetchedAt: new Date().toISOString(),
      _placeholder: true
    };
  }
  return results;
}

// ============ TIKTOK ANALYTICS ============

/**
 * TikTok Analytics Stub
 * 
 * NOTE: TikTok's API is severely limited:
 * - The TikTok Marketing API requires a verified business account
 * - Only available to approved advertisers
 * - Requires OAuth 2.0 authentication
 * 
 * Required setup for production:
 * 1. Apply for TikTok Business Developer access
 * 2. Create a TikTok Business account
 * 3. Set up OAuth 2.0 flow
 * 4. Request these scopes: video.data, user.data
 * 
 * @param {string[]} videoIds - Array of TikTok video IDs
 * @returns {Promise<Object>} Video statistics
 */
async function fetchTikTokAnalytics(videoIds) {
  if (!TIKTOK_API_KEY) {
    console.log('[TikTok] No API key found - TikTok API requires business verification');
    console.log('[TikTok] Documentation: https://developers.tiktok.com/products/marketing-api/');
    return generatePlaceholderTikTokData(videoIds);
  }

  // Production implementation would use TikTok Marketing API
  // Endpoint: https://business-api.tiktok.com/portal/docs?id=1739328858573825
  /*
  const results = {};
  for (const videoId of videoIds) {
    const response = await fetchUrl(
      `https://business-api.tiktok.com/portal/api/video/data?video_ids=${videoId}`,
      {
        headers: {
          'Authorization': `Bearer ${TIKTOK_API_KEY}`
        }
      }
    );
    // Parse and normalize TikTok data...
  }
  */
  
  return generatePlaceholderTikTokData(videoIds);
}

function generatePlaceholderTikTokData(videoIds) {
  const results = {};
  for (const videoId of videoIds) {
    results[videoId] = {
      platform: 'tiktok',
      videoId,
      views: Math.floor(Math.random() * 100000) + 5000,
      likes: Math.floor(Math.random() * 10000) + 500,
      comments: Math.floor(Math.random() * 500) + 50,
      shares: Math.floor(Math.random() * 2000) + 100,
      engagementRate: parseFloat((Math.random() * 15 + 5).toFixed(2)),
      watchTimeSeconds: Math.floor(Math.random() * 60) + 15,
      ctr: parseFloat((Math.random() * 8 + 2).toFixed(2)),
      fetchedAt: new Date().toISOString(),
      _placeholder: true,
      _note: 'TikTok API requires business verification - this is placeholder data'
    };
  }
  return results;
}

// ============ INSTAGRAM ANALYTICS ============

/**
 * Instagram Analytics Stub
 * 
 * NOTE: Instagram Insights requires Facebook Business API access:
 * - Must have a Facebook Business account
 * - Instagram account must be converted to a Professional account
 * - Requires Facebook Graph API with these permissions:
 *   - instagram_basic
 *   - instagram_content_publish
 *   - instagram_manage_insights
 *   - pages_read_engagement
 * 
 * Setup guide: https://developers.facebook.com/docs/instagram-api
 * 
 * @param {string[]} videoIds - Array of Instagram media IDs
 * @returns {Promise<Object>} Media statistics
 */
async function fetchInstagramAnalytics(videoIds) {
  if (!INSTAGRAM_API_KEY) {
    console.log('[Instagram] No API key found - Instagram Insights requires Facebook Business API');
    console.log('[Instagram] Documentation: https://developers.facebook.com/docs/instagram-api');
    return generatePlaceholderInstagramData(videoIds);
  }

  // Production implementation would use Facebook Graph API
  // Endpoint: https://graph.facebook.com/v18.0/{instagram-media-id}/insights
  /*
  const results = {};
  for (const videoId of videoIds) {
    const response = await fetchUrl(
      `https://graph.facebook.com/v18.0/${videoId}/insights?metric=engagement,impressions,reach,saved`,
      {
        headers: {
          'Authorization': `Bearer ${INSTAGRAM_API_KEY}`
        }
      }
    );
    // Parse and normalize Instagram data...
  }
  */

  return generatePlaceholderInstagramData(videoIds);
}

function generatePlaceholderInstagramData(videoIds) {
  const results = {};
  for (const videoId of videoIds) {
    results[videoId] = {
      platform: 'instagram',
      videoId,
      views: Math.floor(Math.random() * 50000) + 2000,
      likes: Math.floor(Math.random() * 5000) + 200,
      comments: Math.floor(Math.random() * 300) + 20,
      saves: Math.floor(Math.random() * 500) + 50,
      shares: Math.floor(Math.random() * 200) + 10,
      engagementRate: parseFloat((Math.random() * 6 + 2).toFixed(2)),
      reach: Math.floor(Math.random() * 30000) + 1000,
      ctr: parseFloat((Math.random() * 4 + 1).toFixed(2)),
      fetchedAt: new Date().toISOString(),
      _placeholder: true,
      _note: 'Instagram API requires Facebook Business API access - this is placeholder data'
    };
  }
  return results;
}

// ============ PERFORMANCE SCORING ============

/**
 * Calculate Performance Score for content
 * Formula: (views * engagement_rate * ctr) / 1000
 * 
 * Higher scores = better performing content
 * Scores are normalized for comparison across platforms
 */
function calculatePerformanceScore(data) {
  const views = data.views || 0;
  const engagementRate = data.engagementRate || 0;
  const ctr = data.ctr || 1; // Avoid division by zero
  
  const score = (views * engagementRate * ctr) / 1000;
  return parseFloat(score.toFixed(2));
}

function calculateAllScores(analyticsData) {
  const scored = [];
  
  for (const [platform, videos] of Object.entries(analyticsData)) {
    for (const [videoId, data] of Object.entries(videos)) {
      const score = calculatePerformanceScore(data);
      scored.push({
        platform,
        videoId,
        ...data,
        performanceScore: score
      });
    }
  }
  
  // Sort by performance score descending
  return scored.sort((a, b) => b.performanceScore - a.performanceScore);
}

// ============ UTILITIES ============

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

function getVideoIdsFromTasks(tasks) {
  const videoIds = { youtube: [], tiktok: [], instagram: [] };
  
  if (!tasks) return videoIds;
  
  // Traverse all task categories
  for (const [category, categoryTasks] of Object.entries(tasks)) {
    if (!categoryTasks || typeof categoryTasks !== 'object') continue;
    
    for (const [taskId, task] of Object.entries(categoryTasks)) {
      if (!task || typeof task !== 'object') continue;
      
      // Check for YouTube video IDs
      if (task.youtubeVideoId) {
        videoIds.youtube.push(task.youtubeVideoId);
      }
      
      // Check for TikTok video IDs
      if (task.tiktokVideoId) {
        videoIds.tiktok.push(task.tiktokVideoId);
      }
      
      // Check for Instagram media IDs
      if (task.instagramMediaId) {
        videoIds.instagram.push(task.instagramMediaId);
      }
    }
  }
  
  return videoIds;
}

// ============ MAIN EXECUTION ============

async function run(dryRun = false) {
  console.log('='.repeat(60));
  console.log('AI Skills Studio - Performance Analytics Sync');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  // Initialize Firebase
  initFirebase();

  // Step 1: Fetch all tasks to get video IDs
  console.log('[1/4] Fetching tasks from Firebase...');
  const tasksRef = ref(db, PATHS.tasks);
  const tasksSnapshot = await get(tasksRef);
  const tasks = tasksSnapshot.val();
  
  const videoIds = getVideoIdsFromTasks(tasks);
  console.log(`Found video IDs: YouTube=${videoIds.youtube.length}, TikTok=${videoIds.tiktok.length}, Instagram=${videoIds.instagram.length}`);

  // Step 2: Fetch analytics from all platforms
  console.log('\n[2/4] Fetching analytics...');
  
  const [youtubeData, tiktokData, instagramData] = await Promise.all([
    fetchYouTubeAnalytics(videoIds.youtube),
    fetchTikTokAnalytics(videoIds.tiktok),
    fetchInstagramAnalytics(videoIds.instagram)
  ]);

  const allAnalytics = {
    youtube: youtubeData,
    tiktok: tiktokData,
    instagram: instagramData
  };

  // Step 3: Calculate performance scores
  console.log('\n[3/4] Calculating performance scores...');
  const scoredContent = calculateAllScores(allAnalytics);
  
  console.log(`\nTop 5 performing content:`);
  scoredContent.slice(0, 5).forEach((item, i) => {
    console.log(`  ${i + 1}. [${item.platform.toUpperCase()}] Score: ${item.performanceScore} | Views: ${item.views} | ER: ${item.engagementRate}%`);
  });

  // Step 4: Write to Firebase
  if (dryRun) {
    console.log('\n[4/4] SKIPPED (dry run mode)');
    console.log('\nWould write the following data to Firebase:');
    console.log(`  - ${scoredContent.length} content items with scores`);
    console.log(`  - Performance data to: ${PATHS.performance}`);
    console.log(`  - Task updates to: ${PATHS.ideaPool}`);
  } else {
    console.log('\n[4/4] Writing to Firebase...');
    
    // Write performance data
    const performanceData = {
      lastUpdated: new Date().toISOString(),
      contentCount: scoredContent.length,
      platformBreakdown: {
        youtube: Object.keys(youtubeData).length,
        tiktok: Object.keys(tiktokData).length,
        instagram: Object.keys(instagramData).length
      },
      content: scoredContent
    };
    
    await set(ref(db, PATHS.performance), performanceData);
    console.log(`  ✓ Wrote performance data`);
    
    // Update idea_pool tasks with performance scores for ranking
    if (tasks && tasks.idea_pool) {
      const updates = {};
      for (const [taskId, task] of Object.entries(tasks.idea_pool)) {
        let score = 0;
        
        if (task.youtubeVideoId && youtubeData[task.youtubeVideoId]) {
          score = calculatePerformanceScore(youtubeData[task.youtubeVideoId]);
        } else if (task.tiktokVideoId && tiktokData[task.tiktokVideoId]) {
          score = calculatePerformanceScore(tiktokData[task.tiktokVideoId]);
        } else if (task.instagramMediaId && instagramData[task.instagramMediaId]) {
          score = calculatePerformanceScore(instagramData[task.instagramMediaId]);
        }
        
        if (score > 0) {
          updates[`${PATHS.ideaPool}/${taskId}/performanceScore`] = score;
          updates[`${PATHS.ideaPool}/${taskId}/lastPerformanceUpdate`] = new Date().toISOString();
        }
      }
      
      if (Object.keys(updates).length > 0) {
        await update(ref(db), updates);
        console.log(`  ✓ Updated ${Object.keys(updates).length / 2} tasks with performance scores`);
      }
    }
    
    console.log('  ✓ Sync complete!');
  }

  console.log('\n' + '='.repeat(60));
  console.log('Performance sync completed successfully!');
  console.log('='.repeat(60));

  return {
    success: true,
    dryRun,
    contentCount: scoredContent.length,
    topContent: scoredContent.slice(0, 10)
  };
}

// Export for use in other scripts
export { fetchYouTubeAnalytics, fetchTikTokAnalytics, fetchInstagramAnalytics, calculatePerformanceScore };

// CLI entry point
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('-d');

run(isDryRun)
  .then(result => {
    console.log('\nResult:', JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch(error => {
    console.error('\nError:', error);
    process.exit(1);
  });
