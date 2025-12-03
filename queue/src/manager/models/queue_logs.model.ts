import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum QueueStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  NOT_FOUND = 'NOT_FOUND',
}

@Entity()
export class QueueLogs {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @PrimaryColumn({ type: 'varchar', length: 250 })
  queue_name: string;

  @Column({ type: 'json', nullable: true })
  payload: any;

  @Column({ type: 'varchar', length: 250, nullable: true })
  status: QueueStatus;

  @Column({ type: 'json', nullable: true })
  errorData: any;

  @Column({ type: 'text', nullable: true })
  errorStack: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
