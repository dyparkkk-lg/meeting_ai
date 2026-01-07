export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKey: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.S3_SECRET_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'meetings',
    region: process.env.S3_REGION || 'us-east-1',
    presignedUrlExpiresIn: parseInt(process.env.PRESIGNED_URL_EXPIRES_IN || '600', 10), // 10분
  },

  providers: {
    asr: process.env.ASR_PROVIDER || 'mock',
    llm: process.env.LLM_PROVIDER || 'mock',
  },

  // OpenAI (Whisper ASR, GPT LLM)
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // Ollama (내부 LLM 서버)
  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3',
    apiKey: process.env.OLLAMA_API_KEY,
  },
});
