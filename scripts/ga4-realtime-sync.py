#!/usr/bin/env python3
"""
GA4 Realtime Sync - AI Skills Studio Website Analytics

Syncs Google Analytics 4 data to Firebase for unified dashboard view.
Pulls realtime and daily analytics data from GA4 Measurement Protocol.

Setup:
1. Create a GA4 property in Google Analytics
2. Get your Measurement ID (G-XXXXXXXXXX) and API Secret
3. Set environment variables:
   - GA4_MEASUREMENT_ID=G-XXXXXXXXXX
   - GA4_API_SECRET=your_api_secret
   - GA4_PROPERTY_ID=XXXXXXXXX

For server-side GA4 Data API access:
1. Create a Google Cloud project
2. Enable Google Analytics Data API
3. Create a service account and download JSON key
4. Set GOOGLE_APPLICATION_CREDENTIALS to your key file

Usage:
    python ga4-realtime-sync.py --dry-run
    python ga4-realtime-sync.py --daily
    python ga4-realtime-sync.py --realtime
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import urllib.request
import urllib.parse

# Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import credentials, db
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    print("[Warning] Firebase Admin SDK not available. Run: pip install firebase-admin")

# Google Analytics Data API
try:
    from google.analytics.data import BetaAnalyticsDataClient
    from google.analytics.data_v1.types import RunReportRequest, DateRange
    from google.oauth2 import service_account
    GA4_DATA_AVAILABLE = True
except ImportError:
    GA4_DATA_AVAILABLE = False
    print("[Warning] GA4 Data API not available. Run: pip install google-analytics-data")

# ============ CONFIGURATION ============

FIREBASE_URL = "https://winslow-756c3-default-rtdb.firebaseio.com"
GA4_PATHS = {
    "realtime": "workspaces/winslow_main/projects/content_factory/analytics/realtime",
    "daily": "workspaces/winslow_main/projects/content_factory/analytics/daily",
    "summary": "workspaces/winslow_main/projects/content_factory/analytics/summary"
}

# Environment variables
GA4_MEASUREMENT_ID = os.getenv("GA4_MEASUREMENT_ID", "")
GA4_API_SECRET = os.getenv("GA4_API_SECRET", "")
GA4_PROPERTY_ID = os.getenv("GA4_PROPERTY_ID", "")
GOOGLE_APPLICATION_CREDENTIALS = os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "")


class GA4RealtimeSync:
    """Sync GA4 analytics data to Firebase"""
    
    def __init__(self, dry_run: bool = False):
        self.dry_run = dry_run
        self.firebase_db = None
        
        if FIREBASE_AVAILABLE and not self.dry_run:
            self._init_firebase()
        
        if GA4_DATA_AVAILABLE and GOOGLE_APPLICATION_CREDENTIALS:
            self._init_ga4_client()
        else:
            self.ga4_client = None
            print("[GA4] No credentials configured - using placeholder data")
    
    def _init_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            # Use application default credentials or service account
            if os.path.exists(GOOGLE_APPLICATION_CREDENTIALS):
                cred = credentials.Certificate(GOOGLE_APPLICATION_CREDENTIALS)
                firebase_admin.initialize_app(cred, {
                    'databaseURL': FIREBASE_URL
                })
            else:
                # Try application default credentials
                firebase_admin.initialize_app(options={
                    'databaseURL': FIREBASE_URL
                })
            self.firebase_db = db.reference("")
            print("[Firebase] Connected successfully")
        except Exception as e:
            print(f"[Firebase] Initialization error: {e}")
            self.firebase_db = None
    
    def _init_ga4_client(self):
        """Initialize GA4 Data API client"""
        try:
            if os.path.exists(GOOGLE_APPLICATION_CREDENTIALS):
                credentials_obj = service_account.Credentials.from_service_account_file(
                    GOOGLE_APPLICATION_CREDENTIALS
                )
                self.ga4_client = BetaAnalyticsDataClient(credentials=credentials_obj)
                print("[GA4] Data API client initialized")
            else:
                self.ga4_client = None
        except Exception as e:
            print(f"[GA4] Client initialization error: {e}")
            self.ga4_client = None
    
    def run(self, mode: str = "all"):
        """Run sync in specified mode"""
        print("=" * 60)
        print("AI Skills Studio - GA4 Analytics Sync")
        print("=" * 60)
        print(f"Mode: {'DRY RUN' if self.dry_run else 'LIVE'}")
        print(f"Action: {mode}")
        print(f"Started: {datetime.now().isoformat()}")
        print()
        
        if mode in ("all", "realtime"):
            self._sync_realtime()
        
        if mode in ("all", "daily"):
            self._sync_daily()
        
        if mode in ("all", "summary"):
            self._sync_summary()
        
        print()
        print("=" * 60)
        print("GA4 sync completed!")
        print("=" * 60)
    
    def _sync_realtime(self):
        """Sync realtime analytics data"""
        print("[1/3] Syncing realtime data...")
        
        # GA4 Realtime API via Measurement Protocol (client-side data)
        # For server-side realtime, use the Data API with realtime report
        if self.ga4_client and GA4_PROPERTY_ID:
            try:
                realtime_data = self._fetch_ga4_realtime()
            except Exception as e:
                print(f"  [Error] GA4 realtime fetch failed: {e}")
                realtime_data = self._generate_placeholder_realtime()
        else:
            realtime_data = self._generate_placeholder_realtime()
        
        self._write_to_firebase(GA4_PATHS["realtime"], realtime_data)
        print(f"  ✓ Wrote realtime data: {realtime_data.get('activeUsers', 0)} active users")
    
    def _fetch_ga4_realtime(self) -> Dict:
        """Fetch realtime data from GA4 Data API"""
        try:
            property_id = f"properties/{GA4_PROPERTY_ID}"
            
            response = self.ga4_client.run_realtime_report(
                property=property_id,
                dimensions=["unifiedPageScreen", "deviceCategory", "country", "city"],
                metrics=["activeUsers", "screenPageViews", "engagementRate"]
            )
            
            active_users = 0
            top_pages = []
            
            for row in response.rows:
                active_users += int(row.metric_values[0].value)
                top_pages.append({
                    "page": row.dimension_values[0].value,
                    "users": int(row.metric_values[0].value),
                    "views": int(row.metric_values[1].value)
                })
            
            # Sort by users and take top 10
            top_pages = sorted(top_pages, key=lambda x: x["users"], reverse=True)[:10]
            
            return {
                "activeUsers": active_users,
                "topPages": top_pages,
                "lastUpdated": datetime.now().isoformat(),
                "source": "ga4_api"
            }
        except Exception as e:
            print(f"  [GA4 API Error] {e}")
            return self._generate_placeholder_realtime()
    
    def _generate_placeholder_realtime(self) -> Dict:
        """Generate placeholder realtime data when no API access"""
        return {
            "activeUsers": 0,
            "topPages": [],
            "lastUpdated": datetime.now().isoformat(),
            "source": "placeholder",
            "_note": "Configure GA4 credentials for real data"
        }
    
    def _sync_daily(self):
        """Sync daily analytics summary"""
        print("[2/3] Syncing daily data...")
        
        if self.ga4_client and GA4_PROPERTY_ID:
            try:
                daily_data = self._fetch_ga4_daily()
            except Exception as e:
                print(f"  [Error] GA4 daily fetch failed: {e}")
                daily_data = self._generate_placeholder_daily()
        else:
            daily_data = self._generate_placeholder_daily()
        
        self._write_to_firebase(GA4_PATHS["daily"], daily_data)
        print(f"  ✓ Wrote daily data: {daily_data.get('sessions', 0)} sessions")
    
    def _fetch_ga4_daily(self) -> Dict:
        """Fetch daily data from GA4 Data API"""
        try:
            property_id = f"properties/{GA4_PROPERTY_ID}"
            yesterday = (datetime.now() - timedelta(days=1)).strftime("%YYYY-%m-%d")
            
            response = self.ga4_client.run_report(
                property=property_id,
                dates=[DateRange(start_date=yesterday, end_date=yesterday)],
                dimensions=["date", "deviceCategory", "channelGrouping"],
                metrics=["sessions", "totalUsers", "newUsers", "bounceRate", "averageSessionDuration", "screenPageViews"]
            )
            
            sessions = 0
            users = 0
            new_users = 0
            page_views = 0
            device_breakdown = {}
            channel_breakdown = {}
            
            for row in response.rows:
                date, device, channel = [v.value for v in row.dimension_values]
                sess, usrs, new_usr, bounce, duration, pv = [float(m.value) for m in row.metric_values]
                
                sessions += int(sess)
                users += int(usrs)
                new_users += int(new_usr)
                page_views += int(pv)
                
                device_breakdown[device] = device_breakdown.get(device, 0) + int(sess)
                channel_breakdown[channel] = channel_breakdown.get(channel, 0) + int(sess)
            
            return {
                "date": yesterday,
                "sessions": sessions,
                "users": users,
                "newUsers": new_users,
                "pageViews": page_views,
                "bounceRate": round(bounce, 2) if bounce else 0,
                "avgSessionDuration": round(duration, 2) if duration else 0,
                "deviceBreakdown": device_breakdown,
                "channelBreakdown": channel_breakdown,
                "lastUpdated": datetime.now().isoformat(),
                "source": "ga4_api"
            }
        except Exception as e:
            print(f"  [GA4 API Error] {e}")
            return self._generate_placeholder_daily()
    
    def _generate_placeholder_daily(self) -> Dict:
        """Generate placeholder daily data when no API access"""
        return {
            "date": datetime.now().strftime("%Y-%m-%d"),
            "sessions": 0,
            "users": 0,
            "newUsers": 0,
            "pageViews": 0,
            "bounceRate": 0,
            "avgSessionDuration": 0,
            "deviceBreakdown": {},
            "channelBreakdown": {},
            "lastUpdated": datetime.now().isoformat(),
            "source": "placeholder",
            "_note": "Configure GA4 credentials for real data"
        }
    
    def _sync_summary(self):
        """Sync overall analytics summary"""
        print("[3/3] Syncing summary data...")
        
        summary = {
            "lastSync": datetime.now().isoformat(),
            "propertyId": GA4_PROPERTY_ID or "not_configured",
            "status": "active"
        }
        
        self._write_to_firebase(GA4_PATHS["summary"], summary)
        print(f"  ✓ Updated summary")
    
    def _write_to_firebase(self, path: str, data: Dict):
        """Write data to Firebase Realtime Database"""
        if self.dry_run:
            print(f"  [DRY RUN] Would write to {path}")
            print(f"  Data: {json.dumps(data, indent=2, default=str)[:200]}...")
            return
        
        if not self.firebase_db:
            print(f"  [SKIP] Firebase not connected")
            return
        
        try:
            ref = self.firebase_db.child(path)
            ref.set(data)
            print(f"  ✓ Wrote to {path}")
        except Exception as e:
            print(f"  [Error] Firebase write failed: {e}")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="GA4 Realtime Sync to Firebase")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--mode", choices=["all", "realtime", "daily", "summary"], 
                        default="all", help="Sync mode")
    parser.add_argument("--realtime", action="store_true", help="Sync realtime data only")
    parser.add_argument("--daily", action="store_true", help="Sync daily data only")
    
    args = parser.parse_args()
    
    mode = "realtime" if args.realtime else ("daily" if args.daily else args.mode)
    
    sync = GA4RealtimeSync(dry_run=args.dry_run)
    sync.run(mode=mode)


if __name__ == "__main__":
    main()
