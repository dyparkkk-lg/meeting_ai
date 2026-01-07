#!/bin/bash
# test-ollama.sh

echo "=== Ollama LLM 테스트 ==="

# 1. 회의 생성
echo "1. 회의 생성..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/meetings \
  -H "Content-Type: application/json" \
  -d '{"title": "Ollama 통합 테스트"}')

MEETING_ID=$(echo $RESPONSE | jq -r '.meetingId')
UPLOAD_URL=$(echo $RESPONSE | jq -r '.uploadUrl')
OBJECT_KEY=$(echo $RESPONSE | jq -r '.objectKey')
echo "Meeting ID: $MEETING_ID"

# 2. 업로드
echo "2. 파일 업로드..."
echo "test audio" | curl -s -X PUT "$UPLOAD_URL" -H "Content-Type: audio/webm" --data-binary @-

# 3. 처리 시작
echo "3. 처리 시작..."
curl -s -X POST "http://localhost:3000/api/meetings/$MEETING_ID/upload-complete" \
  -H "Content-Type: application/json" \
  -d "{\"objectKey\": \"$OBJECT_KEY\"}" | jq '.'

# 4. 상태 폴링
echo "4. 처리 대기 중..."
for i in {1..30}; do
  STATUS=$(curl -s "http://localhost:3000/api/meetings/$MEETING_ID" | jq -r '.status')
  echo "  [$i] Status: $STATUS"
  if [ "$STATUS" = "READY" ]; then
    echo "✅ 처리 완료!"
    break
  fi
  if [ "$STATUS" = "FAILED" ]; then
    echo "❌ 처리 실패!"
    curl -s "http://localhost:3000/api/meetings/$MEETING_ID" | jq '.errorMessage'
    exit 1
  fi
  sleep 2
done

# 5. 결과 출력
echo "5. 결과:"
curl -s "http://localhost:3000/api/meetings/$MEETING_ID" | jq '.summary'

echo ""
echo "=== 마크다운 미리보기 ==="
curl -s "http://localhost:3000/api/meetings/$MEETING_ID/export.md" | head -30