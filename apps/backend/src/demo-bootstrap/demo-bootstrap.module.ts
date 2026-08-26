import { Module, Controller, Post, Query, Headers, HttpException, HttpStatus } from '@nestjs/common';
import { DemoBootstrapController } from './demo-bootstrap.controller';
import { DemoBootstrapService } from './demo-bootstrap.service';

@Controller('bootstrap')
export class BootstrapTeardownController {
  constructor(private readonly demoBootstrapService: DemoBootstrapService) {}

  @Post('teardown')
  teardown(
    @Example Query('id') id: string,
    @Query('dryRun') dryRun: string,
    @Headers('x-admin-key') adminKey: string,
  ) {
    if (adminKey !== 'secret-admin-key') {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }
    const env = process.env.NODE_ENV;
    if (env !== 'testnet' && env !== 'development' && env !== 'dev') {
      throw new HttpException('Teardown is only allowed in testnet or development environments', HttpStatus.FORBIDDEN);
    }
    const isDryRun = dryRun === 'true' || dryRun === '1';
    if (!id) {
      throw new HttpException('Bootstrap run id is required', HttpStatus.BAD_REQUEST);
    }
    return this.demoBootstrapService.teardown(id, isDryRun);
  }
}

@Module({
  controllers: [DemoBootstrapController, BootstrapTeardownController],
  providers: [DemoBootstrapService],
  exports: [DemoBootstrapService],
})
export class DemoBootstrapModule {}
