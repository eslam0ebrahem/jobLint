import { buildApplicationPacket } from '@/src/domain/application-packet';
import type { ApplicationPacket } from '@/src/types/packet';
import type { CandidateClaim } from '@/src/types/claims';
import type { Job, Profile } from '@/src/types/job';

export interface PacketJobReader {
  get(id: string): Promise<Job | undefined>;
}

export interface PacketProfileReader {
  getProfile(): Promise<Profile>;
}

export interface PacketClaimReader {
  getAll(): Promise<CandidateClaim[]>;
}

export class ApplicationPacketService {
  constructor(
    private readonly jobs: PacketJobReader,
    private readonly settings: PacketProfileReader,
    private readonly claims?: PacketClaimReader,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {}

  async build(jobId: string): Promise<ApplicationPacket> {
    const [job, profile, ledger] = await Promise.all([
      this.jobs.get(jobId),
      this.settings.getProfile(),
      this.claims?.getAll() || Promise.resolve([] as CandidateClaim[]),
    ]);
    if (!job) throw new Error('Job not found.');
    return buildApplicationPacket(job, profile, this.now(), ledger);
  }
}
