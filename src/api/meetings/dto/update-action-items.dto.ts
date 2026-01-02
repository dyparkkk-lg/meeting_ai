import { IsArray, IsOptional, IsString, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class EvidenceDto {
  @IsOptional()
  startMs?: number;

  @IsOptional()
  endMs?: number;

  @IsOptional()
  @IsString()
  quote?: string;
}

class ActionItemDto {
  @IsString()
  task: string;

  @IsOptional()
  @IsString()
  assigneeCandidate?: string | null;

  @IsOptional()
  @IsString()
  dueDate?: string | null;

  @IsOptional()
  @IsIn(['P0', 'P1', 'P2', 'P3'])
  priority?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvidenceDto)
  evidence?: EvidenceDto[];
}

export class UpdateActionItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActionItemDto)
  actionItems: ActionItemDto[];
}

