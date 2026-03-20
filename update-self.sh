#!/bin/bash
DESCRIPTION=${1:-"Self-update complete"}
TOKEN="8796961401:AAHRDuFmwGSBDuiRLbsZP1sADh0gcJhY5x0"
CHAT_ID="8420721200"
curl -s -X POST "https://api.telegram.org/bot$TOKEN/sendMessage" -d "chat_id=$CHAT_ID" -d "text=✅ $DESCRIPTION"
sleep 2
pm2 restart ducell
