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
    console.log('Registration attempt with:', registerDto);

    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await this.hashPassword(registerDto.password);

    const user = this.userRepository.create({
      name: registerDto.name,
      email: registerDto.email,
      password: hashedPassword,
      entityType: registerDto.entityType || 'user',
      entityId: registerDto.entityId || 'default',
      role: registerDto.role || 'user',
    });

    const savedUser = await this.userRepository.save(user);
    console.log('Saved user:', savedUser);

    const token = this.generateToken(savedUser);
    console.log('Generated token payload:', this.jwtService.decode(token));

    return { access_token: token };
  }

  async login(loginDto: LoginDto): Promise<{ access_token: string }> {
    console.log('Login attempt with email:', loginDto.email);

    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    console.log('Found user during login:', user);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await this.comparePasswords(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    console.log('User found during login:', user);

    const token = this.generateToken(user);
    console.log('Login token payload:', this.jwtService.decode(token));

    return { access_token: token };
  }

  async getCurrentUser(id: string): Promise<Omit<User, 'password'>> {
    console.log('Getting user with ID:', id);
    
    const user = await this.userRepository.findOne({ 
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        entityType: true,
        entityId: true,
        createdAt: true,
        updatedAt: true
      }
    });

    console.log('Found user in getCurrentUser:', user);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private generateToken(user: User): string {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      entityType: user.entityType,
      entityId: user.entityId,
    };
    console.log('Generating token with payload:', payload);
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

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepository.findOne({ 
      where: { email },
      select: ['id', 'email', 'password', 'role', 'entityType', 'entityId'] 
    });

    if (user && (await this.comparePasswords(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }
} 