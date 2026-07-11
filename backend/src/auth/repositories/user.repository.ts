import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User } from '../entities/user.entity';

interface CreateUserData {
  nombre: string;
  email: string;
  password: string;
}

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({
      where: { email },
    });
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();
  }

  create(data: CreateUserData): User {
    return this.repository.create(data);
  }

  save(user: User): Promise<User> {
    return this.repository.save(user);
  }
}
