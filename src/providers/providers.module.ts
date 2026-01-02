import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AsrProvider, ASR_PROVIDER } from './asr/asr.interface';
import { MockAsrProvider } from './asr/mock-asr.provider';
import { LlmProvider, LLM_PROVIDER } from './llm/llm.interface';
import { MockLlmProvider } from './llm/mock-llm.provider';

@Module({
  providers: [
    // ASR Provider - 환경 변수에 따라 스위칭 가능
    {
      provide: ASR_PROVIDER,
      useFactory: (configService: ConfigService): AsrProvider => {
        const providerType = configService.get<string>('providers.asr');
        
        switch (providerType) {
          case 'mock':
          default:
            return new MockAsrProvider();
          // v0.1+: 실제 provider 추가
          // case 'whisper':
          //   return new WhisperAsrProvider(configService);
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
        const providerType = configService.get<string>('providers.llm');
        
        switch (providerType) {
          case 'mock':
          default:
            return new MockLlmProvider();
          // v0.1+: 실제 provider 추가
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

