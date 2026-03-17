import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateApplicationDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  applicantName: string;

  @IsNotEmpty()
  @IsString()
  applicantEmail: string;

  @IsOptional()
  metadata?: object;
}
