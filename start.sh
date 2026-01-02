# 1. 인프라
docker compose up -d

# 2. API (별도 터미널)
npx nest build api && node dist/src/api/main.js

# 3. Worker (별도 터미널)  
npx nest build worker && node dist/src/worker/main.js