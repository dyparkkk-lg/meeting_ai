#!/bin/bash

# Meeting AI v0.1 API 테스트 스크립트
# 사용법: ./scripts/test-api.sh

set -e

BASE_URL="${API_URL:-http://localhost:3000/api}"

echo "🧪 Meeting AI v0.1 API 테스트"
echo "=============================="
echo "Base URL: $BASE_URL"
echo ""

# 1. 회의 생성
echo "1️⃣ 회의 생성..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/meetings" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "테스트 회의",
    "languageHint": "ko",
    "contentType": "audio/webm"
  }')

echo "응답: $CREATE_RESPONSE"
echo ""

MEETING_ID=$(echo $CREATE_RESPONSE | grep -o '"meetingId":"[^"]*"' | cut -d'"' -f4)
UPLOAD_URL=$(echo $CREATE_RESPONSE | grep -o '"uploadUrl":"[^"]*"' | cut -d'"' -f4)
OBJECT_KEY=$(echo $CREATE_RESPONSE | grep -o '"objectKey":"[^"]*"' | cut -d'"' -f4)

if [ -z "$MEETING_ID" ]; then
  echo "❌ 회의 생성 실패"
  exit 1
fi

echo "Meeting ID: $MEETING_ID"
echo "Object Key: $OBJECT_KEY"
echo ""

# 2. 파일 업로드 (더미 파일)
echo "2️⃣ 파일 업로드 (더미)..."
echo "dummy audio content for testing" > /tmp/test-audio.webm

UPLOAD_RESULT=$(curl -s -w "%{http_code}" -o /dev/null -X PUT "$UPLOAD_URL" \
  -H "Content-Type: audio/webm" \
  --data-binary @/tmp/test-audio.webm)

if [ "$UPLOAD_RESULT" -eq 200 ]; then
  echo "✅ 업로드 성공 (HTTP $UPLOAD_RESULT)"
else
  echo "⚠️ 업로드 결과: HTTP $UPLOAD_RESULT"
fi
echo ""

# 3. 업로드 완료 알림 (비동기 처리 시작)
echo "3️⃣ 업로드 완료 알림 (비동기 처리 시작)..."
COMPLETE_RESPONSE=$(curl -s -X POST "$BASE_URL/meetings/$MEETING_ID/upload-complete" \
  -H "Content-Type: application/json" \
  -d "{\"objectKey\": \"$OBJECT_KEY\"}")

echo "응답: $COMPLETE_RESPONSE"
echo ""

STATUS=$(echo $COMPLETE_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
echo "상태: $STATUS (UPLOADED 예상)"
echo ""

# 4. 처리 완료 대기
echo "4️⃣ Worker 처리 대기 중..."
MAX_WAIT=30
WAIT_COUNT=0

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
  MEETING_RESPONSE=$(curl -s "$BASE_URL/meetings/$MEETING_ID")
  CURRENT_STATUS=$(echo $MEETING_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  
  echo "  상태: $CURRENT_STATUS"
  
  if [ "$CURRENT_STATUS" = "READY" ]; then
    echo "✅ 처리 완료!"
    break
  elif [ "$CURRENT_STATUS" = "FAILED" ]; then
    echo "❌ 처리 실패!"
    ERROR_MSG=$(echo $MEETING_RESPONSE | grep -o '"errorMessage":"[^"]*"' | cut -d'"' -f4)
    echo "에러: $ERROR_MSG"
    exit 1
  fi
  
  sleep 1
  WAIT_COUNT=$((WAIT_COUNT + 1))
done

if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
  echo "⚠️ 타임아웃 (${MAX_WAIT}초)"
  echo "Worker가 실행 중인지 확인하세요: npm run dev:worker"
fi
echo ""

# 5. 회의 목록 조회
echo "5️⃣ 회의 목록 조회..."
curl -s "$BASE_URL/meetings?page=1&limit=5" | head -c 300
echo "..."
echo ""

# 6. 회의 상세 조회
echo "6️⃣ 회의 상세 조회..."
DETAIL_RESPONSE=$(curl -s "$BASE_URL/meetings/$MEETING_ID")
echo "응답 (일부): $(echo $DETAIL_RESPONSE | head -c 500)..."
echo ""

# 7. 마크다운 내보내기
echo "7️⃣ 마크다운 내보내기..."
curl -s "$BASE_URL/meetings/$MEETING_ID/export.md" -o /tmp/meeting-export.md
echo "파일 저장됨: /tmp/meeting-export.md"
echo ""
echo "--- 마크다운 내용 (처음 30줄) ---"
head -30 /tmp/meeting-export.md
echo ""
echo "..."
echo ""

# 정리
rm -f /tmp/test-audio.webm

echo "=============================="
echo "✅ 테스트 완료!"
echo ""
echo "회의 ID: $MEETING_ID"
echo "마크다운: /tmp/meeting-export.md"
