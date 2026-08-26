import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('bootstrap_runs')
export class BootstrapRun {
  @primaryGeneratedColumn('uuid')
  id: string;

  @column({ unique: true })
  runId: string;

  @column()
  environment: string;

  @column({ type: 'json' })
  resources: any;

  @createDateColumn()
  createdAt: Date;
}
