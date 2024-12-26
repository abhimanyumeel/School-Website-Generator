import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegisterDto } from '../dto/auth/register.dto';
import { LoginDto } from '../dto/auth/login.dto';
import * as bcrypt from 'bcrypt';
import { User } from '../entities';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<{ access_token: string }> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash the password
    const hashedPassword = await this.hashPassword(registerDto.password);

    // Create new user
    const user = this.userRepository.create({
      ...registerDto,
      password: hashedPassword,
    });

    // Save the user
    await this.userRepository.save(user);

    // Generate JWT token
    const token = this.generateToken(user);

    return { access_token: token };
  }

  async login(loginDto: LoginDto): Promise<{ access_token: string }> {
    // Find user by email
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('User not found with this email');
    }

    // Verify password
    const isPasswordValid = await this.comparePasswords(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Incorrect password');
    }

    // Generate JWT token
    const token = this.generateToken(user);

    return { access_token: token };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({ where: { email } });

    if (user && (await this.comparePasswords(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      entityType: user.entityType,
      entityId: user.entityId,
    };

    return this.jwtService.sign(payload);
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt();
    return bcrypt.hash(password, salt);
  }

  private async comparePasswords(
    plainTextPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainTextPassword, hashedPassword);
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  async getCurrentUser(id: string): Promise<Omit<User, 'password'>> {
    const user = await this.findById(id);
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
} 