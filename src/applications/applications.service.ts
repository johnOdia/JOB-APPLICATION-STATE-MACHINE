import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AllApplicationStatuses as ApplicationStatus } from '../common/enums';
import { Prisma } from '@prisma/client';
import { UserRole } from '..//common/enums';
import { CreateApplicationDto } from './dto/create-application.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ApplicationContractedEvent } from '../events/application-contracted.event';

interface ApplicationStatusChangeDto {
  applicationId: string;
  newStatus: ApplicationStatus;
  changedBy: string;
  metadata?: Prisma.JsonValue;
  contractUrl?: string;
  userRole?: UserRole;
}

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Define allowed transitions
  private allowedTransitions: Record<ApplicationStatus, ApplicationStatus[]> = {
    APPLIED: [ApplicationStatus.INTERVIEWING, ApplicationStatus.CLOSED],
    INTERVIEWING: [ApplicationStatus.CONTRACTED, ApplicationStatus.CLOSED],
    CONTRACTED: [ApplicationStatus.COMPLETED, ApplicationStatus.CLOSED],
    COMPLETED: [],
    CLOSED: [],
  };

  async createApplication(dto: CreateApplicationDto) {
    return await this.prisma.$transaction(
      async (tx) => {
        // 1️⃣ Create application
        const application = await tx.applications.create({
          data: {
            title: dto.title,
            applicantName: dto.applicantName,
            applicantEmail: dto.applicantEmail,
            status: 'APPLIED',
            metadata: dto.metadata,
          },
        });

        // 2️⃣ Log initial status
        await tx.statushistory.create({
          data: {
            newStatus: ApplicationStatus.APPLIED,
            previousStatus: null,
            changedBy: dto.applicantName,
            metadata: dto.metadata ?? {},
            application: {
              connect: { id: application.id },
            },
          },
        });

        // 3️⃣ Return the application
        return application;
      },
      {
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }

  async changeStatus(data: ApplicationStatusChangeDto) {
    const { applicationId, newStatus, changedBy, metadata, contractUrl } = data;

    // Fetch current application
    const application = await this.prisma.applications.findUnique({
      where: { id: applicationId },
    });

    if (!application) throw new NotFoundException('Application not found');

    const currentStatus = application.status;

    // 🔹 Validate transition
    const allowedNextStatuses = this.allowedTransitions[currentStatus];

    if (!allowedNextStatuses.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}. Status should be one of: ${allowedNextStatuses.join(', ')}`,
      );
    }

    // CONTRACTED requires contractUrl
    if (newStatus === ApplicationStatus.CONTRACTED && !contractUrl) {
      throw new BadRequestException(
        'contractUrl is required for CONTRACTED status',
      );
    }

    // Perform transaction: update + audit log
    return this.prisma.$transaction(
      async (tx) => {
        const updatedApp = await tx.applications.update({
          where: { id: applicationId },
          data: {
            status: newStatus,
            contractUrl: contractUrl ?? null,
          },
        });

        await tx.statushistory.create({
          data: {
            applicationId,
            previousStatus: application.status,
            newStatus,
            changedBy,
            metadata,
          },
        });

        // send email for CONTRACTED
        if (newStatus === ApplicationStatus.CONTRACTED) {
          this.eventEmitter.emit(
            'application.contracted',
            new ApplicationContractedEvent(
              application.title,
              application.contractUrl!,
              application.applicantName,
              application.applicantEmail,
            ),
          );
        }

        return updatedApp;
      },
      {
        maxWait: 5000,
        timeout: 10000,
      },
    );
  }

  async getHistory(applicationId: string) {
    const application = await this.prisma.applications.findUnique({
      where: { id: applicationId },
      include: {
        statusHistory: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    return application;
  }
}
