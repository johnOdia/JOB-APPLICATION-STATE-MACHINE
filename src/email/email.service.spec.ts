// src/email/email.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { ApplicationContractedEvent } from '../events/application-contracted.event';

// Mock Resend entirely
jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn(),
      },
    })),
  };
});

describe('EmailService', () => {
  let service: EmailService;
  let resendSendMock: jest.Mock;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();

    service = module.get<EmailService>(EmailService);

    // Grab the mocked send function
    resendSendMock = (service as any).resend.emails.send as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should send email successfully on ApplicationContractedEvent', async () => {
    // Arrange
    const event = new ApplicationContractedEvent(
      'Software Engineer',
      'https://contract-url.com',
      'Charlie User',
      'charlie@example.com',
    );

    resendSendMock.mockResolvedValue({ id: 'email123', status: 'sent' });

    // Act
    await service.handleApplicationContractedEvent(event);

    // Assert
    expect(resendSendMock).toHaveBeenCalledTimes(1);
    expect(resendSendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'onboarding@resend.dev',
        to: 'efosajohnodia@gmail.com', // demo email as in service
        subject: 'Software Engineer',
        html: expect.stringContaining('Charlie User'),
      }),
    );
  });

  it('should retry sending email on failure', async () => {
    // Arrange
    const event = new ApplicationContractedEvent(
      'Frontend Developer',
      'https://contract-url.com',
      'Alice User',
      'alice@example.com',
    );

    // Fail twice, then succeed
    resendSendMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Temporary error'))
      .mockResolvedValue({ id: 'email456', status: 'sent' });

    // Spy on console to suppress output during test
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});

    // Act
    await service.handleApplicationContractedEvent(event);

    // Assert
    expect(resendSendMock).toHaveBeenCalledTimes(3); // 2 failures + 1 success
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('should throw after max retries', async () => {
    const event = new ApplicationContractedEvent(
      'Backend Developer',
      'https://contract-url.com',
      'Bob User',
      'bob@example.com',
    );

    resendSendMock.mockRejectedValue(new Error('Bad Gateway'));

    await expect(
      service.handleApplicationContractedEvent(event),
    ).rejects.toThrow('Bad Gateway');

    expect(resendSendMock).toHaveBeenCalledTimes(3); // max retries
  });
});
