# Meeting AI v0.1 - 회의 기록/정리 서비스 MVP

회의 오디오를 업로드하면 비동기로 전사(ASR)하고, AI가 요약/결정사항/액션아이템을 자동 추출하는 서비스입니다.

## ✨ 주요 기능

- 🎙️ **음성 전사 (ASR)**: 회의 오디오를 텍스트로 변환
- 📝 **AI 요약**: 회의 내용 자동 요약 및 핵심 포인트 추출
- ✅ **결정사항 추출**: 회의에서 결정된 사항 자동 식별
- 📌 **액션 아이템**: 담당자/기한 정보와 함께 할 일 목록 생성
- ⚠️ **리스크 식별**: 잠재적 이슈 및 미결 질문 추출
- 📄 **마크다운 내보내기**: 정리된 회의록 문서 생성

## 🛠️ 기술 스택

| 구분 | 기술 |
|------|------|
| **Framework** | NestJS (Monorepo) |
| **Language** | TypeScript |
| **Database** | PostgreSQL + Prisma ORM |
| **Queue** | Redis + BullMQ |
| **Storage** | MinIO (S3 호환) |
| **ASR Provider** | Mock (v0.2+에서 Whisper/Google 지원 예정) |
| **LLM Provider** | Mock (v0.2+에서 OpenAI/Anthropic 지원 예정) |

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client                                      │
└─────────────────────────────────────────────────────────────────────────┘
                    │                              │
         POST /meetings                   PUT (Presigned URL)
                    │                              │
                    ▼                              ▼
┌────────────────────────────────┐    ┌─────────────────────────────────┐
│      API Server (NestJS)       │    │       MinIO (S3 호환)            │
│      localhost:3000            │    │       localhost:9000             │
│                                │    └─────────────────────────────────┘
│  • 회의 생성 + Presigned URL   │
│  • upload-complete → enqueue   │
│  • 결과 조회/수정/export       │
└────────────────┬───────────────┘
                 │ enqueue (BullMQ)
                 ▼
┌─────────────────────────────────┐
│      Redis (localhost:6379)     │
│      Queue: meeting-pipeline    │
└────────────────┬────────────────┘
                 │ consume
                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Worker (NestJS)                                   │
│                                                                         │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐            │
│   │  TRANSCRIBE  │───▶│  SUMMARIZE   │───▶│  RENDER_MD   │            │
│   │   (ASR)      │    │   (LLM)      │    │  (Markdown)  │            │
│   └──────────────┘    └──────────────┘    └──────────────┘            │
└────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌─────────────────────────┐
                    │  PostgreSQL (Prisma)    │
                    │  localhost:5432         │
                    └─────────────────────────┘
```

## 🔄 상태 머신 (State Machine)

```
CREATED → UPLOADED → ASR_DONE → SUMMARY_DONE → MD_DONE → READY
                                                      ↘ FAILED
```

| 상태 | 설명 |
|------|------|
| `CREATED` | 회의 생성됨, Presigned URL 발급 완료 |
| `UPLOADED` | 오디오 파일 업로드 완료, 처리 대기 중 |
| `ASR_DONE` | 음성 전사(ASR) 완료 |
| `SUMMARY_DONE` | LLM 분석/요약 완료 |
| `MD_DONE` | 마크다운 문서 생성 완료 |
| `READY` | 모든 처리 완료, 결과 조회 가능 |
| `FAILED` | 처리 중 오류 발생 |

## 🚀 빠른 시작

### 1. 필수 요구사항

- Node.js >= 20.0.0
- Docker & Docker Compose
- npm

### 2. 인프라 실행 (Docker)

```bash
# PostgreSQL + Redis + MinIO 실행
npm run docker:infra

# 인프라 상태 확인
docker compose ps
```

### 3. 의존성 설치

```bash
npm install
```

### 4. 데이터베이스 마이그레이션

```bash
npx prisma generate
npx prisma migrate deploy
```

### 5. 서버 실행 (로컬)

**방법 1: 동시 실행**
```bash
npm run dev
```

**방법 2: 별도 터미널에서 각각 실행**

터미널 1 - API 서버:
```bash
npm run dev:api
# 🚀 API: http://localhost:3000/api
```

터미널 2 - Worker:
```bash
npm run dev:worker
# 🔧 Worker started
```

## 📋 API 엔드포인트

### 회의 생성 및 업로드 URL 발급

```bash
curl -X POST http://localhost:3000/api/meetings \
  -H "Content-Type: application/json" \
  -d '{
    "title": "팀 미팅",
    "languageHint": "ko",
    "contentType": "audio/webm"
  }'
```

**응답:**
```json
{
  "meetingId": "uuid",
  "uploadUrl": "http://localhost:9000/meetings/...",
  "objectKey": "meetings/uuid/xxx.webm"
}
```

### 파일 업로드 (Presigned URL 사용)

```bash
curl -X PUT "<uploadUrl>" \
  -H "Content-Type: audio/webm" \
  --data-binary @recording.webm
```

### 업로드 완료 알림 (비동기 처리 시작)

```bash
curl -X POST http://localhost:3000/api/meetings/<meetingId>/upload-complete \
  -H "Content-Type: application/json" \
  -d '{
    "objectKey": "meetings/uuid/xxx.webm"
  }'
```

**응답 (즉시 반환, 백그라운드 처리):**
```json
{
  "meetingId": "uuid",
  "status": "UPLOADED",
  "message": "Upload complete. Processing started."
}
```

### 회의 목록 조회

```bash
curl "http://localhost:3000/api/meetings?page=1&limit=20"
```

### 회의 상세 조회

```bash
curl http://localhost:3000/api/meetings/<meetingId>
```

**응답 (status: READY일 때):**
```json
{
  "id": "uuid",
  "title": "팀 미팅",
  "status": "READY",
  "transcript": {
    "segments": [
      { "startMs": 0, "endMs": 5000, "text": "안녕하세요...", "speaker": "Speaker 1" }
    ]
  },
  "summary": {
    "overallSummary": ["신규 프로젝트 일정 논의..."],
    "decisions": [...],
    "actionItems": [...],
    "risks": [...],
    "openQuestions": [...]
  },
  "mdContent": "# 회의록\n..."
}
```

### 액션 아이템 수정

```bash
curl -X PUT http://localhost:3000/api/meetings/<meetingId>/action-items \
  -H "Content-Type: application/json" \
  -d '{
    "actionItems": [
      {
        "task": "API 문서화 완료",
        "assigneeCandidate": "김철수",
        "dueDate": "2024-01-15",
        "priority": "P1",
        "evidence": []
      }
    ]
  }'
```

### 마크다운 내보내기

```bash
curl http://localhost:3000/api/meetings/<meetingId>/export.md -o meeting.md
```

## 🗄️ 데이터 모델

### Meeting
```prisma
model Meeting {
  id             String        @id @default(uuid())
  title          String?       // 회의 제목
  status         MeetingStatus @default(CREATED)
  audioObjectKey String?       // MinIO 오브젝트 키
  languageHint   String?       @default("ko")
  errorMessage   String?       // 실패 시 에러 메시지
  
  transcript     Transcript?   // 전사 결과
  summary        Summary?      // 요약 결과
  export         Export?       // 내보내기 결과
}
```

### Transcript (전사 결과)
```prisma
model Transcript {
  meetingId String  @unique
  segments  Json    // [{ startMs, endMs, text, speaker }]
}
```

### Summary (요약 결과)
```prisma
model Summary {
  meetingId     String @unique
  result        Json   // { overallSummary, decisions, actionItems, risks, openQuestions }
  promptVersion String // 프롬프트 버전 관리
  modelVersion  String // 모델 버전 관리
}
```

### Export (내보내기 결과)
```prisma
model Export {
  meetingId   String @unique
  mdContent   String // 마크다운 전체 내용
  mdObjectKey String? // MinIO 저장 경로 (옵션)
}
```

## 📁 프로젝트 구조

```
meeting_ai/
├── docker-compose.yml         # 인프라 (Postgres, Redis, MinIO)
├── nest-cli.json              # NestJS Monorepo 설정
├── package.json
├── tsconfig.json
├── prisma/
│   ├── schema.prisma          # DB 스키마
│   └── migrations/            # 마이그레이션 파일
├── packages/
│   └── shared/
│       └── src/types/         # 공유 타입 정의
└── src/
    ├── api/                   # API 서버 (HTTP)
    │   ├── main.ts            # API 진입점
    │   ├── api.module.ts
    │   └── meetings/
    │       ├── meetings.controller.ts
    │       ├── meetings.service.ts
    │       ├── meetings.module.ts
    │       └── dto/           # 요청/응답 DTO
    │
    ├── worker/                # Worker (Background Job)
    │   ├── main.ts            # Worker 진입점
    │   ├── worker.module.ts
    │   └── processors/
    │       ├── meeting.processor.ts  # Job 처리 로직
    │       ├── processors.module.ts
    │       └── md-renderer.ts        # 마크다운 생성
    │
    ├── shared/                # 공유 모듈 (API + Worker 공용)
    │   ├── shared.module.ts
    │   └── queue/
    │       ├── queue.constants.ts    # 큐 이름, Job 타입
    │       ├── queue.module.ts       # BullMQ 설정
    │       └── queue.service.ts      # Job enqueue
    │
    ├── prisma/                # Prisma 서비스
    │   ├── prisma.module.ts
    │   └── prisma.service.ts
    │
    ├── storage/               # 스토리지 서비스 (MinIO/S3)
    │   ├── storage.module.ts
    │   └── storage.service.ts
    │
    ├── providers/             # 외부 Provider
    │   ├── providers.module.ts
    │   ├── asr/               # ASR (음성 인식)
    │   │   ├── asr.interface.ts
    │   │   └── mock-asr.provider.ts
    │   └── llm/               # LLM (언어 모델)
    │       ├── llm.interface.ts
    │       └── mock-llm.provider.ts
    │
    └── config/
        └── configuration.ts   # 환경변수 설정
```

## ⚙️ API vs Worker 비교

| 구분 | API Server | Worker |
|------|-----------|--------|
| **역할** | HTTP 요청 처리 | Background Job 처리 |
| **진입점** | `src/api/main.ts` | `src/worker/main.ts` |
| **생성 방식** | `NestFactory.create()` | `NestFactory.createApplicationContext()` |
| **HTTP 서버** | ✅ (포트 3000) | ❌ |
| **처리 시간** | 빠른 응답 (< 1초) | 오래 걸림 (ASR/LLM 처리) |
| **입력** | HTTP Request | Redis Queue Job |

## 🔧 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `PORT` | API 서버 포트 | 3000 |
| `NODE_ENV` | 실행 환경 | development |
| `DATABASE_URL` | PostgreSQL 연결 URL | - |
| `REDIS_HOST` | Redis 호스트 | localhost |
| `REDIS_PORT` | Redis 포트 | 6379 |
| `S3_ENDPOINT` | MinIO 엔드포인트 | http://localhost:9000 |
| `S3_ACCESS_KEY` | MinIO 접근 키 | minioadmin |
| `S3_SECRET_KEY` | MinIO 비밀 키 | minioadmin |
| `S3_BUCKET` | 버킷 이름 | meetings |
| `S3_REGION` | S3 리전 | us-east-1 |
| `PRESIGNED_URL_EXPIRES_IN` | Presigned URL 만료(초) | 600 |
| `ASR_PROVIDER` | ASR 제공자 (mock) | mock |
| `LLM_PROVIDER` | LLM 제공자 (mock) | mock |

## 🧪 E2E 테스트

```bash
# 1. 회의 생성
RESPONSE=$(curl -s -X POST http://localhost:3000/api/meetings \
  -H "Content-Type: application/json" \
  -d '{"title": "테스트 회의"}')

MEETING_ID=$(echo $RESPONSE | jq -r '.meetingId')
UPLOAD_URL=$(echo $RESPONSE | jq -r '.uploadUrl')
OBJECT_KEY=$(echo $RESPONSE | jq -r '.objectKey')

echo "Meeting ID: $MEETING_ID"

# 2. 더미 파일 업로드
echo "dummy audio" | curl -s -X PUT "$UPLOAD_URL" \
  -H "Content-Type: audio/webm" --data-binary @-

# 3. 업로드 완료 알림
curl -s -X POST "http://localhost:3000/api/meetings/$MEETING_ID/upload-complete" \
  -H "Content-Type: application/json" \
  -d "{\"objectKey\": \"$OBJECT_KEY\"}"

# 4. 상태 확인 (READY가 될 때까지 대기)
sleep 3
curl -s "http://localhost:3000/api/meetings/$MEETING_ID" | jq '.status'

# 5. 마크다운 확인
curl -s "http://localhost:3000/api/meetings/$MEETING_ID/export.md" | head -30
```

## 🐳 Docker 명령어

```bash
# 인프라 시작
npm run docker:infra

# 인프라 중지
npm run docker:infra:down

# 로그 확인
docker compose logs -f postgres
docker compose logs -f redis
docker compose logs -f minio

# MinIO Console 접속
# http://localhost:9001 (minioadmin / minioadmin)

# Prisma Studio (DB GUI)
npx prisma studio
```

## 📜 npm 스크립트

```bash
# 개발
npm run dev              # API + Worker 동시 실행
npm run dev:api          # API만 실행 (watch)
npm run dev:worker       # Worker만 실행 (watch)

# 빌드
npm run build            # 전체 빌드
npm run build:api        # API만 빌드
npm run build:worker     # Worker만 빌드

# 데이터베이스
npm run prisma:generate  # Prisma Client 생성
npm run prisma:migrate   # 마이그레이션 적용
npm run prisma:studio    # DB GUI 실행

# 인프라
npm run docker:infra     # 인프라 시작
npm run docker:infra:down # 인프라 중지
```

## 🔮 v0.2+ 확장 계획

- [ ] 실제 ASR Provider 연동 (Whisper, Google Speech-to-Text)
- [ ] 실제 LLM Provider 연동 (OpenAI, Anthropic)
- [ ] 용어집/고유명사 사전 지원
- [ ] 회의 삭제 API
- [ ] 재처리 API (force 옵션)
- [ ] 웹훅 알림 (처리 완료 시)
- [ ] 인증/인가 (JWT)
- [ ] 멀티테넌시 지원

## 📄 라이선스

MIT
