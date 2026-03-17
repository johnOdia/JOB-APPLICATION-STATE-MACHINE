import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsService } from './applications.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AllApplicationStatuses as ApplicationStatus } from '../common/enums';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let eventEmitter: EventEmitter2;

  const mockPrisma = {
    applications: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    statushistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createApplication', () => {
    it('should create an application and log initial status', async () => {
      const dto = {
        title: 'Backend Engineer',
        applicantName: 'John Doe',
        applicantEmail: 'john@example.com',
        metadata: { experience: 3 },
      };

      const application = {
        id: 'app1',
        ...dto,
        status: 'APPLIED',
      };

      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          applications: {
            create: jest.fn().mockResolvedValue(application),
          },
          statushistory: {
            create: jest.fn().mockResolvedValue({}),
          },
        }),
      );

      const result = await service.createApplication(dto);

      expect(result).toEqual(application);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('changeStatus', () => {
    it('should throw if application does not exist', async () => {
      mockPrisma.applications.findUnique.mockResolvedValue(null);

      await expect(
        service.changeStatus({
          applicationId: '1',
          newStatus: ApplicationStatus.INTERVIEWING,
          changedBy: 'Admin',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw for invalid transition', async () => {
      mockPrisma.applications.findUnique.mockResolvedValue({
        id: '1',
        status: ApplicationStatus.APPLIED,
      });

      await expect(
        service.changeStatus({
          applicationId: '1',
          newStatus: ApplicationStatus.COMPLETED,
          changedBy: 'Admin',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should update status and log history', async () => {
      const application = {
        id: '1',
        status: ApplicationStatus.APPLIED,
        title: 'Engineer',
        applicantName: 'John',
        applicantEmail: 'john@example.com',
      };

      mockPrisma.applications.findUnique.mockResolvedValue(application);

      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          applications: {
            update: jest.fn().mockResolvedValue({
              ...application,
              status: ApplicationStatus.INTERVIEWING,
            }),
          },
          statushistory: {
            create: jest.fn().mockResolvedValue({}),
          },
        }),
      );

      const result = await service.changeStatus({
        applicationId: '1',
        newStatus: ApplicationStatus.INTERVIEWING,
        changedBy: 'Admin',
      });

      expect(result.status).toBe(ApplicationStatus.INTERVIEWING);
    });

    it('should emit event when status becomes CONTRACTED', async () => {
      const application = {
        id: '1',
        status: ApplicationStatus.INTERVIEWING,
        title: 'Engineer',
        applicantName: 'John',
        applicantEmail: 'john@example.com',
      };

      mockPrisma.applications.findUnique.mockResolvedValue(application);

      mockPrisma.$transaction.mockImplementation(async (cb) =>
        cb({
          applications: {
            update: jest.fn().mockResolvedValue({
              ...application,
              status: ApplicationStatus.CONTRACTED,
            }),
          },
          statushistory: {
            create: jest.fn().mockResolvedValue({}),
          },
        }),
      );

      await service.changeStatus({
        applicationId: '1',
        newStatus: ApplicationStatus.CONTRACTED,
        changedBy: 'Admin',
        contractUrl: 'https://contract.com',
      });

      expect(eventEmitter.emit).toHaveBeenCalled();
    });
  });

  describe('getHistory', () => {
    it('should return application with status history', async () => {
      const application = {
        id: '1',
        statusHistory: [],
      };

      mockPrisma.applications.findUnique.mockResolvedValue(application);

      const result = await service.getHistory('1');

      expect(result).toEqual(application);
    });

    it('should throw if application not found', async () => {
      mockPrisma.applications.findUnique.mockResolvedValue(null);

      await expect(service.getHistory('1')).rejects.toThrow(NotFoundException);
    });
  });
});
