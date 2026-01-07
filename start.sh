# 0. llm Ollama test
curl -X POST http://172.23.78.70:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-8b90ce19acdd4a19ad7dd52941c8d7c8" \
  -d '{
    "model": "qwen3-coder:30b",
    "messages": [{"role": "user", "content": "안녕"}],
    "max_tokens": 100
  }'

# 1. 인프라
docker compose up -d


export NODE_TLS_REJECT_UNAUTHORIZED=0
# 2. API (별도 터미널)
npx nest build api && npm run dev:api

# 3. Worker (별도 터미널)  
npx nest build worker && npm run dev:worker

