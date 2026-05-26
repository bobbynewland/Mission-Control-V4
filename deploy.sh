#!/bin/bash
cd /root/.openclaw/workspace/mission-control-v3
npm run build
npx vercel --prod --yes
