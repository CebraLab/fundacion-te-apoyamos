import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { UserType } from './models/user.model';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sign-in')
  async signIn(@Body() body: any) {
    return this.authService.signIn(body.username, body.password);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async me(@Req() req: any) {
    return this.authService.me(req.user);
  }

  @Get('users')
  @UseGuards(AuthGuard)
  async listUsers(@Req() req: any) {
    if (req.user.user_type !== UserType.ADMIN) {
      throw new UnauthorizedException();
    }
    return this.authService.listUsers();
  }

  @Post('users')
  @UseGuards(AuthGuard)
  async createUser(@Body() user: any) {
    return this.authService.createUser(user);
  }

  @Delete('users/:username')
  @UseGuards(AuthGuard)
  async deleteUser(@Param('username') username: string) {
    return this.authService.deleteUser(username);
  }

  @Get('api-keys')
  @UseGuards(AuthGuard)
  async listApiKeys(@Req() req: any) {
    if (req.user.user_type !== UserType.ADMIN) {
      throw new UnauthorizedException();
    }
    return this.authService.listApiKeys();
  }

  @Post('api-keys')
  @UseGuards(AuthGuard)
  async createApiKey(@Body() data: any, @Req() req: any) {
    if (req.user.user_type !== UserType.ADMIN) {
      throw new UnauthorizedException();
    }
    return this.authService.createApiKey(data.name);
  }

  @Delete('api-keys/:name')
  @UseGuards(AuthGuard)
  async deleteApiKey(@Param('name') name: string, @Req() req: any) {
    if (req.user.user_type !== UserType.ADMIN) {
      throw new UnauthorizedException();
    }
    return this.authService.deleteApiKey(name);
  }
}
