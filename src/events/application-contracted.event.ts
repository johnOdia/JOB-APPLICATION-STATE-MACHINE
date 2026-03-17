export class ApplicationContractedEvent {
  constructor(
    public readonly title: string,
    public readonly contractUrl: string,
    public readonly userName: string,
    public readonly email: string, // recipient email
  ) {}
}
