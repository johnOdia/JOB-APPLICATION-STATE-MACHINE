import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ApplicationContractedEvent } from '../events/application-contracted.event';
import { Resend } from 'resend';
import { BadGatewayException } from '@nestjs/common';

@Injectable()
export class EmailService {
  private resend = new Resend(process.env['RESEND_API_KEY']);

  @OnEvent('application.contracted')
  async handleApplicationContractedEvent(
    event: ApplicationContractedEvent,
  ): Promise<void> {
    try {
      // call your actual email sending logic here
      await this.sendContractEmail(
        event.email,
        event.userName,
        event.contractUrl,
        event.title,
      );
    } catch (err) {
      console.error('Email sending failed:', err);
      throw new BadGatewayException();
    }
  }

  private async sendContractEmail(
    email: string,
    applicantName: string,
    contractUrl: string,
    title: string,
  ) {
    const MAX_RETRIES = 3;
    const BASE_DELAY = 1000; // 1 second

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await this.resend.emails.send({
          from: 'onboarding@resend.dev',
          to: 'efosajohnodia@gmail.com', // demo restriction due to domain, replace with actual recipient in production
          subject: title,
          html: `
                <h2>Hello ${applicantName},</h2>
                <p>Your job application has been contracted.</p>
                <p>Please review and sign your contract below:</p>
                <a href="${contractUrl}">View Contract</a>
              `,
        });

        console.log('✅ Email sent successfully:', res);

        return res; // success — exit retry loop
      } catch (error) {
        console.error(`❌ Email attempt ${attempt} failed`, error);

        if (attempt === MAX_RETRIES) {
          console.error('🚨 Email permanently failed after retries', {
            email,
            applicantName,
            contractUrl,
          });

          throw error;
        }

        // exponential backoff
        const delay = BASE_DELAY * Math.pow(2, attempt - 1);

        console.log(`⏳ Retrying email in ${delay}ms...`);

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
}
