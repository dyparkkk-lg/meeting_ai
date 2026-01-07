import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsrProvider, ASR_PROVIDER } from './asr/asr.interface';
import { MockAsrProvider } from './asr/mock-asr.provider';
import { OpenAiAsrProvider } from './asr/openai-asr.provider';
import { LlmProvider, LLM_PROVIDER } from './llm/llm.interface';
import { MockLlmProvider } from './llm/mock-llm.provider';
import { OllamaLlmProvider } from './llm/ollama-llm.provider';

@Module({
  providers: [
    // ASR Provider - 환경 변수에 따라 스위칭 가능
    {
      provide: ASR_PROVIDER,
      useFactory: (configService: ConfigService): AsrProvider => {
        const logger = new Logger('ProvidersModule');
        const providerType = configService.get<string>('providers.asr');

        logger.log(`Initializing ASR Provider: ${providerType}`);

        switch (providerType) {
          case 'openai':
            const openaiApiKey = configService.get<string>('openai.apiKey');
            if (!openaiApiKey) {
              throw new Error('OPENAI_API_KEY is required for OpenAI ASR Provider');
            }
            return new OpenAiAsrProvider(openaiApiKey);

          case 'mock':
          default:
            return new MockAsrProvider();

          // v0.2+: 추가 provider
          // case 'local-whisper':
          //   return new LocalWhisperProvider(configService);
          // case 'google':
          //   return new GoogleAsrProvider(configService);
        }
      },
      inject: [ConfigService],
    },
    // LLM Provider - 환경 변수에 따라 스위칭 가능
    {
      provide: LLM_PROVIDER,
      useFactory: (configService: ConfigService): LlmProvider => {
        const logger = new Logger('ProvidersModule');
        const providerType = configService.get<string>('providers.llm');

        logger.log(`Initializing LLM Provider: ${providerType}`);

        switch (providerType) {
          case 'ollama':
            const baseUrl = configService.get<string>('ollama.baseUrl')!;
            const model = configService.get<string>('ollama.model')!;
            const apiKey = configService.get<string>('ollama.apiKey');
            logger.log(`Ollama config - URL: ${baseUrl}, Model: ${model}`);
            return new OllamaLlmProvider(baseUrl, model, apiKey);

          case 'mock':
          default:
            return new MockLlmProvider();

          // v0.2+: 추가 provider
          // case 'openai':
          //   return new OpenAiLlmProvider(configService);
          // case 'anthropic':
          //   return new AnthropicLlmProvider(configService);
        }
      },
      inject: [ConfigService],
    },
  ],
  exports: [ASR_PROVIDER, LLM_PROVIDER],
})
export class ProvidersModule {}
