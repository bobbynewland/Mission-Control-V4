/**
 * Platform Auto-Poster for AI Skills Studio
 * 
 * Automates publishing content to YouTube, TikTok, Instagram, and Facebook.
 * 
 * REALITY CHECK:
 * - YouTube: FULLY FUNCTIONAL - YouTube Data API v3 supports video uploads
 * - TikTok: STUBBED - TikTok Creator API requires 100k+ followers + special approval
 * - Instagram: STUBBED - Requires Facebook Graph API + Business Verification
 * - Facebook: FUNCTIONAL - Graph API works for Pages, can post Reels
 * 
 * Usage:
 *   node scripts/platform-poster.js                    # Process all ready_publish tasks
 *   node scripts/platform-poster.js --task-id <id>     # Process specific task
 *   node scripts/platform-poster.js --youtube-only      # YouTube only
 *   node scripts/platform-poster.js --facebook-only    # Facebook only
 *   node scripts/platform-poster.js --status           # Check platform connections
 */

import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, update, push } from 'firebase/database';
import { getStorage, ref as storageRef, getDownloadURL } from 'firebase/storage';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// FIREBASE CONFIGURATION
// =============================================================================

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAVmSmiuJDcCAiZhq3xqXSJZnWtviLvnuU",
  authDomain: "winslow-756c3.firebaseapp.com",
  databaseURL: "https://winslow-756c3-default-rtdb.firebaseio.com",
  projectId: "winslow-756c3",
  storageBucket: "winslow-756c3.appspot.com",
  messagingSenderId: "114362401734976703623",
  appId: "1:114362401734976703623:web:abc123def456"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const storage = getStorage(app);

// =============================================================================
// PLATFORM CONFIGURATION
// =============================================================================

const PLATFORM_STATUS_PATH = 'workspaces/winslow_main/platformConnections';

// =============================================================================
// YOUTUBE UPLOADER (FUNCTIONAL)
// =============================================================================

class YouTubeUploader {
  constructor() {
    this.oauth2Client = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return true;
    
    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      console.log('⚠️  YouTube: Missing credentials. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN');
      return false;
    }

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });

    // Test the connection
    try {
      const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
      await youtube.channels.list({ part: 'snippet', mine: true });
      console.log('✅ YouTube: Connected and authenticated');
      await this.updateStatus('youtube', true);
      this.initialized = true;
      return true;
    } catch (error) {
      console.log(`❌ YouTube: Authentication failed - ${error.message}`);
      await this.updateStatus('youtube', false, error.message);
      return false;
    }
  }

  async updateStatus(platform, connected, error = null) {
    try {
      const statusRef = ref(database, `${PLATFORM_STATUS_PATH}/${platform}`);
      await update(statusRef, {
        connected,
        lastChecked: new Date().toISOString(),
        error: error || null
      });
    } catch (e) {
      console.log(`Warning: Could not update platform status: ${e.message}`);
    }
  }

  async uploadVideo(options) {
    const { videoPath, title, description, tags = [], thumbnailPath, playlistId } = options;

    if (!await this.initialize()) {
      throw new Error('YouTube not initialized');
    }

    const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });

    console.log(`📤 YouTube: Starting upload - "${title}"`);

    // Read video file
    const videoContent = fs.readFileSync(videoPath);

    // Upload video
    const res = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title,
          description,
          tags,
          categoryId: '22' // People & Blogs
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: fs.createReadStream(videoPath)
      }
    });

    const videoId = res.data.id;
    console.log(`✅ YouTube: Video uploaded successfully - ID: ${videoId}`);

    // Upload thumbnail if provided
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      try {
        await youtube.thumbnails.set({
          videoId,
          media: { body: fs.createReadStream(thumbnailPath) }
        });
        console.log('✅ YouTube: Thumbnail set');
      } catch (e) {
        console.log(`⚠️  YouTube: Thumbnail upload failed - ${e.message}`);
      }
    }

    // Add to playlist if specified
    if (playlistId) {
      try {
        await youtube.playlistItems.insert({
          part: 'snippet',
          requestBody: {
            snippet: {
              playlistId,
              resourceId: { kind: 'youtube#video', videoId }
            }
          }
        });
        console.log(`✅ YouTube: Added to playlist ${playlistId}`);
      } catch (e) {
        console.log(`⚠️  YouTube: Playlist add failed - ${e.message}`);
      }
    }

    return {
      platform: 'youtube',
      success: true,
      videoId,
      url: `https://youtube.com/watch?v=${videoId}`,
      postedAt: new Date().toISOString()
    };
  }
}

// =============================================================================
// TIKTOK POSTER (STUBBED)
// =============================================================================

/**
 * TikTok Creator API - REALITY CHECK:
 * 
 * TikTok's API is EXTREMELY limited. Direct video posting is NOT available to most developers.
 * 
 * REQUIREMENTS:
 * - TikTok for Developers application
 * - Creator API access requires 100,000+ followers
 * - Special approval from TikTok
 * - Business verification
 * 
 * WORKAROUNDS:
 * 1. Buffer API - Third-party posting (requires separate Buffer account)
 * 2. Publer API - Third-party posting (requires Publer subscription)
 * 3. Later.com - Third-party posting (requires Later subscription)
 * 4. Manual upload reminder - Notify Bobby to post manually
 * 
 * Reference: https://developers.tiktok.com/products/creator-api/
 */

class TikTokPoster {
  constructor() {
    this.platform = 'tiktok';
    this.supported = false;
  }

  async initialize() {
    const clientKey = process.env.TIKTOK_CLIENT_KEY;
    const clientSecret = process.env.TIKTOK_CLIENT_SECRET;

    if (clientKey && clientSecret) {
      console.log('⚠️  TikTok: Credentials found but API access requires 100k+ followers + special approval');
    } else {
      console.log('⚠️  TikTok: No credentials set (API requires 100k+ followers)');
    }
    
    await this.updateStatus(false, 'API requires 100k+ followers and special approval');
    return false;
  }

  async updateStatus(connected, error = null) {
    try {
      const statusRef = ref(database, `${PLATFORM_STATUS_PATH}/tiktok`);
      await update(statusRef, {
        connected,
        lastChecked: new Date().toISOString(),
        error: error || 'API requires 100k+ followers and special approval'
      });
    } catch (e) {
      console.log(`Warning: Could not update platform status: ${e.message}`);
    }
  }

  async postVideo(options) {
    const { videoPath, title, description } = options;

    console.log('═'.repeat(60));
    console.log('📌 TIKTOK STUB - What this WOULD do:');
    console.log('═'.repeat(60));
    console.log(`   Video: ${videoPath}`);
    console.log(`   Title: ${title}`);
    console.log(`   Description: ${description}`);
    console.log('═'.repeat(60));
    console.log('⚠️  REALITY: TikTok Creator API requires:');
    console.log('   1. 100,000+ followers on your TikTok account');
    console.log('   2. Special approval from TikTok');
    console.log('   3. Business verification');
    console.log('');
    console.log('💡 ALTERNATIVES:');
    console.log('   • Buffer API (bufferapp.com) - Third-party posting');
    console.log('   • Publer API (publer.io) - Third-party posting');
    console.log('   • Later.com - Third-party posting');
    console.log('═'.repeat(60));

    return {
      platform: 'tiktok',
      success: false,
      skipped: true,
      reason: 'TikTok API requires 100k+ followers and special approval',
      workaround: 'Use Buffer, Publer, or Later for third-party posting',
      alternatives: [
        { name: 'Buffer', url: 'https://buffer.com' },
        { name: 'Publer', url: 'https://publer.io' },
        { name: 'Later', url: 'https://later.com' }
      ]
    };
  }
}

// =============================================================================
// INSTAGRAM POSTER (STUBBED)
// =============================================================================

/**
 * Instagram Graph API - REALITY CHECK:
 * 
 * Instagram posting via API requires:
 * 1. Facebook Business Verification
 * 2. Facebook Developer App with Instagram product added
 * 3. Instagram Business or Creator account
 * 4. Proper permissions (pages_read_engagement, instagram_basic, instagram_content_publish)
 * 
 * SETUP STEPS:
 * 1. Create Facebook Developer Account → developers.facebook.com
 * 2. Create a Facebook App (Business type)
 * 3. Add "Instagram" product to your app
 * 4. Configure Instagram Basic Display (if needed)
 * 5. Complete Business Verification (requires documents)
 * 6. Connect your Instagram Business/Creator account
 * 7. Generate Page Access Token with required permissions
 * 
 * Reference: https://developers.facebook.com/docs/instagram-api
 */

class InstagramPoster {
  constructor() {
    this.platform = 'instagram';
    this.supported = false;
  }

  async initialize() {
    const accountId = process.env.INSTAGRAM_ACCOUNT_ID;

    if (accountId) {
      console.log('⚠️  Instagram: Account ID found but requires Facebook Business verification');
    } else {
      console.log('⚠️  Instagram: No account ID set (requires Facebook Business verification)');
    }
    
    await this.updateStatus(false, 'Requires Facebook Business verification');
    return false;
  }

  async updateStatus(connected, error = null) {
    try {
      const statusRef = ref(database, `${PLATFORM_STATUS_PATH}/instagram`);
      await update(statusRef, {
        connected,
        lastChecked: new Date().toISOString(),
        error: error || 'Requires Facebook Business verification'
      });
    } catch (e) {
      console.log(`Warning: Could not update platform status: ${e.message}`);
    }
  }

  async postVideo(options) {
    const { videoPath, caption, thumbnailPath } = options;

    console.log('═'.repeat(60));
    console.log('📌 INSTAGRAM STUB - What this WOULD do:');
    console.log('═'.repeat(60));
    console.log(`   Video: ${videoPath}`);
    console.log(`   Caption: ${caption}`);
    console.log('═'.repeat(60));
    console.log('⚠️  REALITY: Instagram API requires:');
    console.log('   1. Facebook Developer Account');
    console.log('   2. Facebook App with Instagram product');
    console.log('   3. Facebook Business Verification (documents)');
    console.log('   4. Instagram Business or Creator account');
    console.log('   5. Page Access Token with permissions');
    console.log('');
    console.log('💡 SETUP STEPS:');
    console.log('   1. Go to developers.facebook.com');
    console.log('   2. Create App → Business type');
    console.log('   3. Add "Instagram" product');
    console.log('   4. Complete Business Verification');
    console.log('   5. Generate access token');
    console.log('═'.repeat(60));

    return {
      platform: 'instagram',
      success: false,
      skipped: true,
      reason: 'Requires Facebook Business verification',
      setupSteps: [
        'Create Facebook Developer Account',
        'Create Facebook App (Business)',
        'Add Instagram product',
        'Complete Business Verification',
        'Connect Instagram Business account',
        'Generate Page Access Token'
      ]
    };
  }
}

// =============================================================================
// FACEBOOK POSTER (FUNCTIONAL)
// =============================================================================

class FacebookPoster {
  constructor() {
    this.initialized = false;
    this.pageAccessToken = null;
    this.pageId = null;
  }

  async initialize() {
    if (this.initialized) return true;

    this.pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    this.pageId = process.env.FACEBOOK_PAGE_ID;

    if (!this.pageAccessToken || !this.pageId) {
      console.log('⚠️  Facebook: Missing credentials. Set FACEBOOK_PAGE_ACCESS_TOKEN and FACEBOOK_PAGE_ID');
      return false;
    }

    // Verify token by getting page info
    try {
      const response = await this.graphRequest(`/${this.pageId}?fields=name&access_token=${this.pageAccessToken}`);
      if (response.error) {
        throw new Error(response.error.message);
      }
      console.log(`✅ Facebook: Connected to Page "${response.name}"`);
      await this.updateStatus(true);
      this.initialized = true;
      return true;
    } catch (error) {
      console.log(`❌ Facebook: Authentication failed - ${error.message}`);
      await this.updateStatus(false, error.message);
      return false;
    }
  }

  async updateStatus(connected, error = null) {
    try {
      const statusRef = ref(database, `${PLATFORM_STATUS_PATH}/facebook`);
      await update(statusRef, {
        connected,
        lastChecked: new Date().toISOString(),
        error: error || null
      });
    } catch (e) {
      console.log(`Warning: Could not update platform status: ${e.message}`);
    }
  }

  graphRequest(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const url = `https://graph.facebook.com/v18.0${endpoint}`;
      const params = new URLSearchParams();
      
      if (options.params) {
        Object.entries(options.params).forEach(([key, value]) => {
          if (value !== undefined) params.append(key, value);
        });
      }

      const fullUrl = `${url}?${params.toString()}`;
      
      https.get(fullUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  async uploadVideo(videoPath, options = {}) {
    const { title, description } = options;

    if (!await this.initialize()) {
      throw new Error('Facebook not initialized');
    }

    console.log(`📤 Facebook: Starting upload - "${title}"`);

    // Facebook requires a two-step process for video uploads
    // Step 1: Initialize the upload session
    const initRes = await this.graphRequest(`/${this.pageId}/video_reels`, {
      params: {
        access_token: this.pageAccessToken,
        upload_phase: 'start',
        file_size: fs.statSync(videoPath).size
      }
    });

    if (initRes.error) {
      throw new Error(initRes.error.message);
    }

    const { video_id, upload_url } = initRes;

    // Step 2: Upload the video data
    const videoData = fs.readFileSync(videoPath);
    const uploadRes = await new Promise((resolve, reject) => {
      const req = https.request(upload_url, { method: 'POST' }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.on('error', reject);
      req.write(videoData);
      req.end();
    });

    if (uploadRes.error) {
      throw new Error(uploadRes.error.message);
    }

    // Step 3: Finish the upload
    const finishRes = await this.graphRequest(`/${this.pageId}/video_reels`, {
      params: {
        access_token: this.pageAccessToken,
        upload_phase: 'finish',
        video_id
      }
    });

    if (finishRes.error) {
      throw new Error(finishRes.error.message);
    }

    console.log(`✅ Facebook: Reel uploaded successfully - ID: ${finishRes.id}`);

    return {
      platform: 'facebook',
      success: true,
      postId: finishRes.id,
      url: `https://facebook.com/${finishRes.id}`,
      postedAt: new Date().toISOString()
    };
  }

  async postVideo(videoPath, options = {}) {
    return this.uploadVideo(videoPath, options);
  }
}

// =============================================================================
// CORE POSTER ENGINE
// =============================================================================

class PlatformPoster {
  constructor() {
    this.youtube = new YouTubeUploader();
    this.tiktok = new TikTokPoster();
    this.instagram = new InstagramPoster();
    this.facebook = new FacebookPoster();
  }

  async initialize() {
    console.log('\n' + '═'.repeat(60));
    console.log('🚀 PLATFORM AUTO-POSTER - Initializing');
    console.log('═'.repeat(60) + '\n');

    // Initialize all platforms
    await Promise.all([
      this.youtube.initialize().catch(e => ({ error: e.message })),
      this.tiktok.initialize().catch(e => ({ error: e.message })),
      this.instagram.initialize().catch(e => ({ error: e.message })),
      this.facebook.initialize().catch(e => ({ error: e.message }))
    ]);

    console.log('\n' + '─'.repeat(60) + '\n');
  }

  async getReadyToPublishTasks() {
    const tasksRef = ref(database, 'workspaces/winslow_main/tasks');
    const snapshot = await get(tasksRef);
    const tasks = snapshot.val() || {};
    
    return Object.entries(tasks)
      .filter(([id, task]) => task.column === 'ready_publish' || task.status === 'ready_publish')
      .map(([id, task]) => ({ id, ...task }));
  }

  async downloadFromUrl(url, destPath) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const file = fs.createWriteStream(destPath);
      
      protocol.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          return this.downloadFromUrl(response.headers.location, destPath).then(resolve).catch(reject);
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });
  }

  async downloadFromFirebaseStorage(storageUrl, destPath) {
    // Firebase Storage URLs need to be converted to download URLs
    const fileRef = storageRef(storage, storageUrl);
    const downloadUrl = await getDownloadURL(fileRef);
    await this.downloadFromUrl(downloadUrl, destPath);
  }

  async processTask(task, platforms) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📋 Processing Task: ${task.id}`);
    console.log(`   Title: ${task.title}`);
    console.log(`   Platforms: ${platforms.join(', ')}`);
    console.log('═'.repeat(60));

    const results = [];
    const tempDir = path.join(__dirname, '../temp');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    for (const platform of platforms) {
      const videoUrl = task.videoUrl || task.mediaUrl;
      const thumbnailUrl = task.thumbnailUrl || task.imageUrl;
      const tempVideoPath = path.join(tempDir, `video_${task.id}_${platform}.mp4`);
      const tempThumbPath = path.join(tempDir, `thumb_${task.id}_${platform}.jpg`);

      try {
        // Download video if URL provided
        if (videoUrl) {
          console.log(`📥 Downloading video for ${platform}...`);
          if (videoUrl.includes('firebasestorage')) {
            await this.downloadFromFirebaseStorage(videoUrl, tempVideoPath);
          } else {
            await this.downloadFromUrl(videoUrl, tempVideoPath);
          }
        }

        // Download thumbnail if URL provided
        if (thumbnailUrl) {
          console.log(`📥 Downloading thumbnail for ${platform}...`);
          if (thumbnailUrl.includes('firebasestorage')) {
            await this.downloadFromFirebaseStorage(thumbnailUrl, tempThumbPath);
          } else {
            await this.downloadFromUrl(thumbnailUrl, tempThumbPath);
          }
        }

        let result;
        
        switch (platform.toLowerCase()) {
          case 'youtube':
            result = await this.youtube.uploadVideo({
              videoPath: tempVideoPath,
              title: task.title || 'Untitled',
              description: task.description || task.body || '',
              tags: task.tags || [],
              thumbnailPath: fs.existsSync(tempThumbPath) ? tempThumbPath : null,
              playlistId: task.youtubePlaylistId
            });
            break;
            
          case 'tiktok':
            result = await this.tiktok.postVideo({
              videoPath: tempVideoPath,
              title: task.title,
              description: task.description || task.body || ''
            });
            break;
            
          case 'instagram':
            result = await this.instagram.postVideo({
              videoPath: tempVideoPath,
              caption: task.caption || task.title,
              thumbnailPath: fs.existsSync(tempThumbPath) ? tempThumbPath : null
            });
            break;
            
          case 'facebook':
            result = await this.facebook.postVideo(tempVideoPath, {
              title: task.title,
              description: task.description || task.body || ''
            });
            break;
            
          default:
            result = { platform, success: false, error: 'Unknown platform' };
        }
        
        results.push(result);
        
      } catch (error) {
        console.log(`❌ ${platform}: Failed - ${error.message}`);
        results.push({
          platform,
          success: false,
          error: error.message
        });
      } finally {
        // Cleanup temp files
        [tempVideoPath, tempThumbPath].forEach(f => {
          if (fs.existsSync(f)) {
            fs.unlinkSync(f);
          }
        });
      }
    }

    // Update task status to published
    const successfulPlatforms = results.filter(r => r.success).map(r => r.platform);
    
    if (successfulPlatforms.length > 0) {
      await update(ref(database, `workspaces/winslow_main/tasks/${task.id}`), {
        column: 'published',
        status: 'published',
        publishedAt: new Date().toISOString(),
        publishedTo: successfulPlatforms,
        publishResults: results
      });
      
      // Log to activity feed
      await push(ref(database, 'workspaces/winslow_main/log'), {
        type: 'publish',
        taskId: task.id,
        taskTitle: task.title,
        platforms: successfulPlatforms,
        results,
        timestamp: new Date().toISOString()
      });
    }

    console.log(`\n✅ Task ${task.id}: Published to ${successfulPlatforms.length}/${platforms.length} platforms`);

    return results;
  }

  async run(options = {}) {
    await this.initialize();

    let tasks;

    if (options.taskId) {
      // Process specific task
      const taskSnapshot = await get(ref(database, `workspaces/winslow_main/tasks/${options.taskId}`));
      if (taskSnapshot.exists()) {
        tasks = [{ id: options.taskId, ...taskSnapshot.val() }];
      } else {
        console.log(`❌ Task ${options.taskId} not found`);
        return;
      }
    } else {
      // Get all ready_to_publish tasks
      tasks = await this.getReadyToPublishTasks();
    }

    if (tasks.length === 0) {
      console.log('📭 No tasks in ready_publish status');
      return;
    }

    console.log(`\n📋 Found ${tasks.length} task(s) to process\n`);

    for (const task of tasks) {
      const platforms = task.tags || task.platforms || [];
      
      if (options.youtubeOnly) {
        await this.processTask(task, ['youtube']);
      } else if (options.facebookOnly) {
        await this.processTask(task, ['facebook']);
      } else {
        await this.processTask(task, platforms);
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Platform publishing complete');
    console.log('═'.repeat(60) + '\n');
  }

  async checkStatus() {
    await this.initialize();
    
    console.log('\n📊 Platform Connection Status:\n');
    
    const statusRef = ref(database, PLATFORM_STATUS_PATH);
    const snapshot = await get(statusRef);
    const status = snapshot.val() || {};
    
    const platforms = [
      { key: 'youtube', name: 'YouTube', functional: true },
      { key: 'facebook', name: 'Facebook', functional: true },
      { key: 'tiktok', name: 'TikTok', functional: false },
      { key: 'instagram', name: 'Instagram', functional: false }
    ];

    for (const p of platforms) {
      const s = status[p.key] || {};
      const icon = s.connected ? '✅' : (p.functional ? '❌' : '⚠️');
      console.log(`  ${icon} ${p.name}: ${s.connected ? 'Connected' : (p.functional ? 'Not configured' : 'API unavailable')}`);
      if (s.error) console.log(`     Error: ${s.error}`);
    }
  }
}

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

const args = process.argv.slice(2);
const poster = new PlatformPoster();

if (args.includes('--status')) {
  poster.checkStatus();
} else if (args.includes('--youtube-only')) {
  poster.run({ youtubeOnly: true });
} else if (args.includes('--facebook-only')) {
  poster.run({ facebookOnly: true });
} else {
  const taskIdArg = args.find(a => a.startsWith('--task-id='));
  const taskId = taskIdArg ? taskIdArg.split('=')[1] : null;
  poster.run({ taskId });
}
