// src/applications/applications.controller.ts
import {
  Controller,
  Patch,
  Body,
  Param,
  Get,
  UseGuards,
  Post,
} from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { RoleGuard } from '../common/guards/roleGuard.guard';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ChangeStatusDto } from './dto/change-status.dto';

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  @Post()
  async create(@Body() dto: CreateApplicationDto) {
    return this.applicationsService.createApplication(dto);
  }

  @Patch(':id/status')
  @UseGuards(new RoleGuard(['ADMIN', 'COMPANY']))
  async updateStatus(@Param('id') id: string, @Body() body: ChangeStatusDto) {
    const { userName, newStatus, metadata, contractUrl } = body;

    return this.applicationsService.changeStatus({
      applicationId: id,
      newStatus,
      changedBy: userName,
      metadata,
      contractUrl,
    });
  }

  @Get(':id/history')
  async getHistory(@Param('id') id: string) {
    return this.applicationsService.getHistory(id);
  }
}
