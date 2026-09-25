import { buildApplicationPacket } from '@/src/domain/application-packet';
import type { ApplicationPacket } from '@/src/types/packet';
import type { Job, Profile } from '@/src/types/job';

export interface PacketJobReader {
  get(id: string): Promise<Job | undefined>;
}

export interface PacketProfileReader {
  getProfile(): Promise<Profile>;
}

export class ApplicationPacketService {
  constructor(
    private readonly jobs: PacketJobReader,
    private readonly settings: PacketProfileReader,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async build(jobId: string): Promise<ApplicationPacket> {
    const [job, profile] = await Promise.all([
      this.jobs.get(jobId),
      this.settings.getProfile(),
    ]);
    if (!job) throw new Error('Job not found.');
    return buildApplicationPacket(job, profile, this.now());
  }
}
