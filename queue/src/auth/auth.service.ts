import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiKey, User, UserType } from './models/user.model';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { CONFIG } from '../utils/config/enviroment.config';
import { Bcrypt } from '../utils/scripts/bcrypt.script';
import { Crypto } from '../utils/scripts/crypto.script';

@Injectable()
export class AuthService {
  private bcrypt: Bcrypt;
  private crypto: Crypto;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(ApiKey)
    private readonly apiKeyRepository: Repository<ApiKey>,
    private jwtService: JwtService,
  ) {
    this.bcrypt = new Bcrypt();
    this.crypto = new Crypto();
  }

  async onModuleInit() {
    const user = await this.userRepository.findOne({
      where: { username: CONFIG.queues.rabbitmq.username },
    });
    const password = await this.bcrypt.hashPassword(
      CONFIG.queues.rabbitmq.password,
    );
    if (!user) {
      await this.userRepository.save({
        username: CONFIG.queues.rabbitmq.username,
        password: password,
        user_type: UserType.ADMIN,
      });
    }
  }

  async signIn(
    username: string,
    pass: string,
  ): Promise<{
    access_token: string;
    user: { username: string; user_type: UserType };
  }> {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) {
      throw new UnauthorizedException();
    }
    const passIsValid = await this.bcrypt.comparePasswrod(pass, user.password);
    if (!passIsValid) {
      throw new UnauthorizedException();
    }
    const payload = {
      sub: user.username,
      username: user.username,
      user_type: user.user_type,
    };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        username: user.username,
        user_type: user.user_type,
      },
    };
  }

  async me(user: any) {
    return user;
  }

  async listUsers() {
    return this.userRepository.find({
      select: ['username', 'user_type'],
    });
  }

  async createUser(user: any) {
    const password = await this.bcrypt.hashPassword(user.password);
    return this.userRepository.save({
      username: user.username,
      password: password,
      user_type: UserType.USER,
    });
  }

  async deleteUser(username: string) {
    return this.userRepository.delete({ username });
  }

  async listApiKeys() {
    return this.apiKeyRepository.find();
  }

  async createApiKey(apiKey: any) {
    const existingApiKey = await this.apiKeyRepository.findOne({
      where: { name: apiKey },
    });
    if (existingApiKey) {
      throw new BadRequestException('Api key already exists');
    }
    const textValue = `cebra_key_${apiKey}`;
    const encryptedText = `rq_${this.crypto.encrypt(textValue)}`;
    return this.apiKeyRepository.save({ name: apiKey, key: encryptedText });
  }

  async deleteApiKey(name: string) {
    return this.apiKeyRepository.delete({ name });
  }

  async validateApiKey(apiKey: string): Promise<boolean> {
    const textSanitized = apiKey.replace('rq_', '');
    let decryptedApiKey = '';
    try {
      decryptedApiKey = this.crypto.decrypt(textSanitized);
    } catch {
      return false;
    }
    const apiKeyName = decryptedApiKey.replace('cebra_key_', '');
    const apiKeyEntity = await this.apiKeyRepository.findOne({
      where: { name: apiKeyName },
    });
    if (!apiKeyEntity) {
      return false;
    }
    return true;
  }
}
