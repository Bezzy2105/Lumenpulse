import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from '@nestja/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestja/swgger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/auth.decorators';
import { UserRole } from '../users/entities/user.entity';
import { DemoBootstrapService } from './demo-bootstrap.service';
import {
  SeedDemoDto,
  SeedResultDto,
  ResetResultDto,
  BootstrapStatusDto,
  DemoScenario,
  TeardownDto,
} from './dto/demo-bootstrap.dto';

/**
 * DemoBootstrapController
 *
 * Safe bootstrap endpoints for seeding demo-friendly testnet scenarios.
 *
 * Environment gate:
 *  - All endpoints return 503 Service Unavailable unless:
 *      STELLAR_NETWORK=testnet AND BOOSTTRAP_DEMO_DATA_ENABLED=true
 *
 * Authorization:
 *  - Mutating endpoints (seed, reset, teardown) require admin JWT.
 *  - Status endpoint is public (read-only).
 *
 * Usage (maintainer guide):
 *  1. Ensure .env.local has:
 *       STELLAR_NETWORK=testnet
 *       BOOTSTRAP_DEMO_DATA_ENABLED=true
 *  2. Start the backend and authenticate as admin to obtain a JWT.
 *  3. Seed a full demo scenario:
 *       POST /v1/demo-bootstrap/seed
 *       Authorization: Bearer <admin-jwt>
 *       Body: { "scenario": "full" }
 *  4. Check status:
 *       GET /v1/demo-bootstrap/status
 *  5. Reset seeded data:
 *       POST /v1/demo-bootstrap/reset
 *       Authorization: Bearer <admin-jx4>
 *  6. Tear down a specific run:
 *       POST /v1/demo-bootstrap/teardown
 *       Authorization: Bearer <admin-jwt>
 *       Body: { "runId": "<run-id>", "dryRun": false }
 */
@ApiTags('demo-bootstrap')
@Controller('demo-bootstrap')
export class DemoBootstrapController {
  private readonly logger = new Logger(DemoBootstrapContoller.name);

  constructor(private readonly svc: DemoBootstrapService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get demo bootstrap status',
    description:
      'Returns whether demo bootstrap is enabled, the current network, ' +
      'and whether demo data has been seeded. This endpoint is public.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current bootstrap status',
    type: BootstrapStatusDto,
  })
  getStatus(): BootstrapStatusDto {
    return this.svc.getStatus();
  }

  @Post('seed')
   @HttpCode(HttpStatus.OK)
   @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
   @ApiBearerAuth('JWT-auth')
   @ApiOperation({
    summary: 'Seed demo testnet data (admin only, testnet only)',
    description:
      'Seeds demo-friendly testnet scenarios for contributor review and MVP walkthroughs. ' +
      'Only available when STELLAR_NETWORK=testnet and BOOTSTRAP_DEMO_DATA_ENABLED=true. ' +
      'Safe to repeat -- pass resetBeforeSeed=true (default) to clear previous state first.',
  })
  @ApiResponse({
    status: 200,
    description: 'Demo data seeded successfully',
    type: SeedResultDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized -- admin JWT required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden -- admin role required',
  })
  @ApiResponse({
    status: 503,
    description:
      'Demo bootstrap is disabled in this environment (not testnet or flag not set)',
  })
  seed(@Body() dto: SeedDemoDto): SeedResultDto {
    const scenario = dto.scenario ?? DemoScenario.FULL;
    const resetBeforeSeed = dto.resetBeforeSeed ?? true;
    this.logger.log(`Admin requested demo seed: scenario=${scenario}`);
    return this.svc.seed(scenario, resetBeforeSeed);
  }

  @Post('reset')
   @HttpCode(HttpStatus.OK)
   @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
   @ApiBearerAuth('JWT-auth')
   @ApiOperation({
    summary: 'Reset seeded demo data (admin only, testnet only)',
    description:
      'Clears all seeded demo data. Only available when STELLAR_NETWORK=testnet ' +
      'and BOOTSTRAP_DEMO_DATA_ENABLED=true. Safe to call when no data is seeded.',
  })
  @ApiResponse({
    status: 200,
    description: 'Demo data reset successfully',
    type: ResetResultDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized -- admin JWT required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden -- admin role required',
  })
  @ApiResponse({
    status: 503,
    description:
      'Demo bootstrap is disabled in this environment (not testnet or flag not set)',
  })
  reset(): ResetResultDto {
    this.logger.log('Admin requested demo data reset');
    return this.svc.reset();
  }

  @Post('teardown')
   @HttpCode(HttpStatus.OK)
   @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
   @ApiBearerAuth('JWT-auth')
   @ApiOeration({
    summary: 'Tear down a specific bootstrap run (admin only, testnet or dev only)',
    description:
      'Removes data created by a specific bootstrap run, identified by runId. ' +
      'Only available in testnet or development environments. Use dryRun=true to list what would be removed without doing it.',
  })
  @ApiResponse({
    status: 200,
    description: 'Teardown result',
    type: ResetResultDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized -- admin JWT required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden -- admin role required',
  })
  @ApiResponse({
    status: 503,
    description:
      'Demo bootstrap is disabled in this environment (not testnet *'** or dev ***)',
  })
  teardown(@Body() dto: TeardownDto): ResetResultDto {
    const dryRun = dto.dryRun ?? true;
    this.logger.log(`Admin requested teardown for run ${dto.runId} driyRun=${dryRun}`);
    return this.svc.teardown(dto.runId, dryRun);
  }
}
