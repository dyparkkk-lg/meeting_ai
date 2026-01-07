#!/bin/bash

# Meeting AI - 실제 오디오 파일 업로드 테스트
# 사용법: ./scripts/upload-meeting.sh [파일경로] [제목]
#
# 예시:
#   ./scripts/upload-meeting.sh ~/download/회의음성.m4a "팀 주간회의"
#   ./scripts/upload-meeting.sh  # 기본값 사용

set -e

# 기본값 설정
AUDIO_FILE="${1:-/Users/dypark/download/회의음성.m4a}"
MEETING_TITLE="${2:-테스트 회의}"
BASE_URL="${API_URL:-http://localhost:3000/api}"

# 파일 확장자에 따른 Content-Type 결정
get_content_type() {
  local file="$1"
  local ext="${file##*.}"
  
  case "$ext" in
    m4a)  echo "audio/mp4" ;;
    mp3)  echo "audio/mpeg" ;;
    wav)  echo "audio/wav" ;;
    webm) echo "audio/webm" ;;
    ogg)  echo "audio/ogg" ;;
    flac) echo "audio/flac" ;;
    *)    echo "audio/mpeg" ;;
  esac
}

CONTENT_TYPE=$(get_content_type "$AUDIO_FILE")

echo "🎙️ Meeting AI - 오디오 업로드"
echo "=============================="
echo "파일: $AUDIO_FILE"
echo "제목: $MEETING_TITLE"
echo "Content-Type: $CONTENT_TYPE"
echo "API: $BASE_URL"
echo ""

# 파일 존재 확인
if [ ! -f "$AUDIO_FILE" ]; then
  echo "❌ 파일을 찾을 수 없습니다: $AUDIO_FILE"
  exit 1
fi

FILE_SIZE=$(ls -lh "$AUDIO_FILE" | awk '{print $5}')
echo "파일 크기: $FILE_SIZE"
echo ""

# 1. 회의 생성 + Presigned URL 발급
echo "1️⃣ 회의 생성 중..."
CREATE_RESPONSE=$(curl -s -X POST "$BASE_URL/meetings" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"$MEETING_TITLE\",
    \"languageHint\": \"ko\",
    \"contentType\": \"$CONTENT_TYPE\"
  }")

echo "응답: $CREATE_RESPONSE"
echo ""

MEETING_ID=$(echo $CREATE_RESPONSE | grep -o '"meetingId":"[^"]*"' | cut -d'"' -f4)
UPLOAD_URL=$(echo $CREATE_RESPONSE | grep -o '"uploadUrl":"[^"]*"' | cut -d'"' -f4)
OBJECT_KEY=$(echo $CREATE_RESPONSE | grep -o '"objectKey":"[^"]*"' | cut -d'"' -f4)

if [ -z "$MEETING_ID" ]; then
  echo "❌ 회의 생성 실패"
  exit 1
fi

echo "✅ 회의 생성 완료"
echo "   Meeting ID: $MEETING_ID"
echo "   Object Key: $OBJECT_KEY"
echo ""

# 2. 파일 업로드
echo "2️⃣ 오디오 파일 업로드 중... (시간이 걸릴 수 있습니다)"
UPLOAD_RESULT=$(curl -s -w "%{http_code}" -o /tmp/upload-response.txt -X PUT "$UPLOAD_URL" \
  -H "Content-Type: $CONTENT_TYPE" \
  --data-binary @"$AUDIO_FILE" \
  --progress-bar)

if [ "$UPLOAD_RESULT" -eq 200 ]; then
  echo "✅ 업로드 성공 (HTTP $UPLOAD_RESULT)"
else
  echo "❌ 업로드 실패 (HTTP $UPLOAD_RESULT)"
  cat /tmp/upload-response.txt
  exit 1
fi
echo ""

# 3. 업로드 완료 알림 → Worker 처리 시작
echo "3️⃣ 업로드 완료 알림 (AI 처리 시작)..."
COMPLETE_RESPONSE=$(curl -s -X POST "$BASE_URL/meetings/$MEETING_ID/upload-complete" \
  -H "Content-Type: application/json" \
  -d "{\"objectKey\": \"$OBJECT_KEY\"}")

echo "응답: $COMPLETE_RESPONSE"
echo ""

# 4. 처리 상태 모니터링
echo "4️⃣ AI 처리 진행 중..."
echo "   (Whisper ASR → Ollama LLM → Markdown 생성)"
echo ""

MAX_WAIT=300  # 최대 5분 대기 (긴 오디오 파일 고려)
WAIT_COUNT=0
LAST_STATUS=""

while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
  MEETING_RESPONSE=$(curl -s "$BASE_URL/meetings/$MEETING_ID")
  CURRENT_STATUS=$(echo $MEETING_RESPONSE | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  
  # 상태가 변경되었을 때만 출력
  if [ "$CURRENT_STATUS" != "$LAST_STATUS" ]; then
    case "$CURRENT_STATUS" in
      "UPLOADED")    echo "   ⏳ 처리 대기 중..." ;;
      "ASR_DONE")    echo "   ✅ 음성 변환 완료 (Whisper)" ;;
      "SUMMARY_DONE") echo "   ✅ AI 요약 완료 (Ollama)" ;;
      "MD_DONE")     echo "   ✅ 마크다운 생성 완료" ;;
      "READY")       echo "   🎉 모든 처리 완료!" ;;
      "FAILED")      echo "   ❌ 처리 실패" ;;
      *)             echo "   📍 상태: $CURRENT_STATUS" ;;
    esac
    LAST_STATUS="$CURRENT_STATUS"
  fi
  
  if [ "$CURRENT_STATUS" = "READY" ]; then
    break
  elif [ "$CURRENT_STATUS" = "FAILED" ]; then
    ERROR_MSG=$(echo $MEETING_RESPONSE | grep -o '"errorMessage":"[^"]*"' | cut -d'"' -f4)
    echo ""
    echo "에러 메시지: $ERROR_MSG"
    exit 1
  fi
  
  sleep 2
  WAIT_COUNT=$((WAIT_COUNT + 2))
  
  # 진행 표시
  if [ $((WAIT_COUNT % 10)) -eq 0 ]; then
    echo "   ... ${WAIT_COUNT}초 경과"
  fi
done

if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
  echo ""
  echo "⚠️ 타임아웃 (${MAX_WAIT}초)"
  echo "   Worker가 실행 중인지 확인하세요: npm run dev:worker"
  exit 1
fi

echo ""

# 5. 결과 조회
echo "5️⃣ 결과 조회 중..."
FINAL_RESPONSE=$(curl -s "$BASE_URL/meetings/$MEETING_ID")

# 요약 정보 추출
SUMMARY=$(echo $FINAL_RESPONSE | grep -o '"overallSummary":\[[^]]*\]' | head -1)
echo ""
echo "📋 요약:"
echo "$SUMMARY" | tr ',' '\n' | sed 's/\["//g' | sed 's/"\]//g' | sed 's/"//g' | head -5
echo ""

# 6. 마크다운 내보내기
OUTPUT_DIR="/tmp/meeting-ai-output"
mkdir -p "$OUTPUT_DIR"

MD_FILE="$OUTPUT_DIR/${MEETING_ID}.md"
curl -s "$BASE_URL/meetings/$MEETING_ID/export.md" -o "$MD_FILE"

echo "=============================="
echo "✅ 처리 완료!"
echo ""
echo "📄 회의 ID: $MEETING_ID"
echo "📝 마크다운: $MD_FILE"
echo ""
echo "결과 조회:"
echo "  curl $BASE_URL/meetings/$MEETING_ID"
echo ""
echo "마크다운 보기:"
echo "  cat $MD_FILE"
echo ""

# 마크다운 미리보기
echo "--- 마크다운 미리보기 (처음 40줄) ---"
head -40 "$MD_FILE"
echo ""
echo "..."

