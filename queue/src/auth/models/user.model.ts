import { Column, Entity, PrimaryColumn } from 'typeorm';

export enum UserType {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

@Entity()
export class User {
  @PrimaryColumn({ type: 'varchar', length: 250 })
  username: string;

  @Column({ type: 'varchar', length: 250 })
  password: string;

  @Column({ type: 'varchar', length: 250 })
  user_type: UserType;
}

@Entity()
export class ApiKey {
  @PrimaryColumn({ type: 'varchar', length: 250 })
  name: string;

  @Column({ type: 'text' })
  key: string;
}
