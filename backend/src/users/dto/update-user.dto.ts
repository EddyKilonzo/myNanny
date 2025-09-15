import { IsOptional, IsString, IsInt, Min } from 'class-validator';

export class UpdateUserProfileDto {
  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  experience?: number;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  password?: string; // already hashed

  @IsOptional()
  profile?: UpdateUserProfileDto;
}
