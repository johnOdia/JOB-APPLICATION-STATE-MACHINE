// src/applications/dto/change-status.dto.ts
import {
  IsEnum,
  IsOptional,
  IsString,
  IsObject,
  IsNotEmpty,
} from 'class-validator';
import { AllApplicationStatuses, AllRoles } from '../../common/enums';

export class ChangeStatusDto {
  @IsNotEmpty()
  @IsEnum(AllApplicationStatuses)
  newStatus: AllApplicationStatuses;

  @IsOptional()
  @IsString()
  contractUrl?: string;

  @IsOptional()
  @IsObject()
  metadata?: any;

  @IsNotEmpty()
  @IsEnum(AllRoles)
  role: string;

  @IsNotEmpty()
  @IsString()
  userName: string;
}
