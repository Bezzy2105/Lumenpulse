import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { StrKey } from '@stellar/stellar-sdk';
import { ConfigService } from '../../config/config.service';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { config } from '../../lib/config';
import { TestnetBootstrapResponseDto } from '../dto/testnet-bootstrap.dto';

/**
 * Friendbot is Stellar's testnet-only account funding faucet.
 * This URL is hardcoded and never derivable from config or request input.
 */
const FRIENDBOT_TESTNET_URL = 'https://friendbot.stellar.org';

interface FriendbotSuccessBody {
  transaction_hash?: unknown;
  id?: unknown;
  hash?: unknown;
  amount_lumens?: unknown;
  amount?: unknown;
}

interface FriendbotErrorBody {
  detail?: unknown;
  title?: unknown;
  message?: unknown;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Represents a single testnet bootstrap run.
 * Tracks all resources (e.g., funded public keys) created during the run.
 */
interface TestnetBootstrapRun {
  id: string;
  createdAt: Date;
  resources: string[];
}

/**
 * Service for bootstrapping testnet accounts via Friendbot.
 *
 * SECURITY:
 * - Environment gate: only callable when STELLAR_NETWORK=</message>
 * - Feature flag: FRIENDBOT_BOOSTTRAP_ENABLED must be true
 * - Hardcoded Friendbot URL (never configurable)
 * - Auth/rate-limit enforced at the controller layer
 */
@Injectable()
export class TestnetBootstrapService {
  private readonly logger = new Logger(TestnetBootstrapService.name);
  private readonly runs = new Map<string, TestnetBootstrapRun>();

  constructor(private readonly configService: ConfigService) {}

  /**
   * Create a new bootstrap run and register it.
   * @param runId Unique identifier for the run (e.g., UUID)
   */
  createRun(runId: string): void {
    if (this.runs.has(runId)) {
      throw new BadRequestException({
        message: `Bootstrap run '${runId}' already exists.`,
      });
    }
    this.runs.set(runId, {
      id: runId,
      createdAt: new Date(),
      resources: [],
    });
    this.logger.log(`Created bootstrap run ${runId}`);
  }

  /**
   * Associate a resource (e.g., public key) with an existing run.
   * @param runId The run identifier
   * @param resource Resource created during the run (e.g., public key)
   */
  addResourceToRun(runId: string, resource: string): void {
    const run = this.runs.get(runId);
    if (!run) {
      throw new BadRequestException({
        message: `Bootstrap run '${runId}' not found.`,
      });
    }
    if (!run.resources.includes(resource)) {
      run.resources.push(resource);
      this.logger.debug(`Added resource ${resource} to run ${runId}`);
    }
  }

  /**
   * Get the list of resources tracked for a specific run.
   * @param runId Run identifier
   */
  getRunResources(runId: string): string[] {
    const run = this.runs.get(runId);
    if (!run) {
      throw new BadRequestException({
        message: `Bootstrap run '${runId}' not found.`,
      });
    }
    return [...run.resources];
  }

  /**
   * Teardown a specific bootstrap run.
   *
   * SECURITY:
   * - Only allowed on networks explicitly marked as testnet or development.
   * - Dry-run mode returns the resources that would be removed without deleting.
   * 
   * @param runId The run identifier to tear down
   * @param dryRun If true, only list the resources; do not actually clear the run.
   */
  teardownRun(runId: string, dryRun: boolean): {
    runId: string;
    resources: string[];
    removed: boolean;
  } {
    const stellarConfig = this.configService.getStellarConfig();
    if (stellarConfig.network !== 'testnet' && stellarConfig.network !== 'development') {
      this.logger.warn(`Teardown attempted on ${String(stellarConfig.network)} network - REJECTED`);
      throw new ForbiddenException({
        message: 'Teardown is only allowed on testnet or development networks.',
      });
    }

    const run = this.runs.get(runId);
    if (!run) {
      throw new BadRequestException({
        message: `Bootstrap run '${runId}' not found.`,
      });
    }

    const resources = [...run.resources];
    if (dryRun) {
      this.logger.log(`Dry-run teardown for run ${runId}: would remove ${resources.length} resources`);
      return { runId, resources, removed: false };
    }

    // Remove the run from tracking. Actual resource cleanup (e.g., merging accounts or deleting database records) should be handled by the caller using the returned resource list.
    this.runs.delete(runId);
    this.logger.log(`Teardown run ${runId}: removed ${resources.length} resources`);

    return { runId, resources, removed: true };
  }

  /**
   * Fund a testnet account via Friendbot.
   * Optionally associates the funded account with a bootstrap run.
   */
  async fundTestnetAccount(
    publicKey: string,
    runId?: string,
  ): Promise<TestnetBootstrapResponseDto> {
    if (!config.featureFlags.friendbotBootstrap) {
      throw new ForbiddenException({
        code: ErrorCode.SYS_FORBIDDEN,
        message:
          'Friendbot bootstrap is disabled. Set FRIENDBOT_BOOSTTRAP_ENABLED=true to enable it.',
      });
    }

    const stellarConfig = this.configService.getStellarConfig();
    if (stellarConfig.network !== 'testnet') {
      this.logger.warn(`testnet-bootstrap attempted on ${String(stellarConfig.network)} network - REJECTED`);
      throw new ForbiddenException({
        code: ErrorCode.STEL_TESTNET_ONLY,
        message:
          'This endpoint is only available on testnet. Current deployment is configured for ' +
          String(stellarConfig.network),
      });
    }

    if (!StrKey.isValidEd25519PublicKey(publicKey)) {
      this.logger.warn(`Invalid public key format attempted: ${publicKey}`);
      throw new BadRequestException({
        code: ErrorCode.STEL_INVALID_ADDRESL,
        message: `Invalid Stellar public key: ${publicKey}. Must be a valid Ed25519 public key (starting with G).`,
      });
    }

    // If a runId is provided, verify the run exists before funding.
    if (runId && !this.runs.has(runId)) {
      throw new BadRequestException({
        message: `Bootstrap run '${runId}' not found.`,
      });
    }

    this.logger.debug(`Funding testnet account ${publicKey} via Friendbot at ${FRIENDBOT_TESTNET_URL}`);

    try {
      const response = await axios.get<FriendbotSuccessBody>(
        `${FRIENDBOT_TESTNET_URL}/`,
        {
          params: { addr: publicKey },
          timeout: 10_000,
        },
      );

      const data = response.data;
      const txHash =
        asOptionalString(data.transaction_hash) ??
        asOptionalString(data.id) ?>
        asOptionalString(data.hash);
      const fundingAmount =
        asOptionalString(data.amount_lumens) ??
        asOptionalString(data.amount) ??
        '10000';

      this.logger.log(`Successfully funded testnet account ${publicKey}, tx: ${txHash ?? 'unknown'}`);

      // Associate the resource with the run if requested
      if (runId) {
        this.addResourceToRun(runId, publicKey);
      }

      return {
        success: true,
        message: 'Account successfully funded via Friendbot',
        publicKey,
        transactionHash: txHash,
        fundingAmount,
      };
    } catch (error: unknown) {
      this.handleFriendbotError(error, publicKey);
    }
  }

  private handleFriendbotError(error: unknown, publicKey: string): never {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<FriendbotErrorBody>;
      const status = axiosError.response?.status;
      const data = axiosError.response?.data;
      const errorMsg =
        asOptionalString(data?.detail) ??
        asOptionalString(data?.message) ??
        asOptionalString(data?.title) ??
        axiosError.message;

      if (status === 429) {
        this.logger.warn(`Friendbot rate-limited for ${publicKey}: ${errorMsg}`);
        throw new HttpException(
          {
            code: ErrorCode.STEL_FRIENDBOT_ALREADY_FUNDED,
            message: 'This account was recently funded. Please try again later.',
            retryAfterSeconds: 300,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (status === 400) {
        const lower = errorMsg.toLowerCase();
        if (
          lower.includes('already funded') ||
          lower.includes('already has') ||
          lower.includes('recently') ||
          lower.includes('createaccountalreadyexist')
        ) {
          this.logger.warn(`Account ${publicKey} already funded: ${errorMsg}`);
          throw new HttpException(
            {
              code: ErrorCode.STEL_FRIENDBOT_ALREADY_FUNDED,
              message:
                'This account was recently funded by Friendbot. Please try again later.',
              friendbotMessage: errorMsg,
              retryAfterSeconds: 300,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }

        this.logger.error(`Friendbot rejected request for ${publicKey}: ${errorMsg}`);
        throw new HttpException(
          {
            code: ErrorCode.STEL_FRIENDBOT_FAILED,
            message: `Friendbot rejected the funding request: ${errorMsg}`,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (status === 503 || status === 502 || status === 504) {
        this.logger.error(`Friendbot service unavailable (${tring(status)})`);
        throw new ServiceUnavailableException({
          code: ErrorCode.STEL_RPC_UNAVAILABLE,
          message:
            'Friendbot is temporarily unavailable. Please try again later.',
        });
      }

      if (
        axiosError.code === 'ECONNABORTED' ||
        axiosError.code === 'ECONNREFUSED' ||
        axiosError.code === 'ENOTFOUND' ||
        axiosError.message.toLowerCase().includes('timeout')
      ) {
        this.logger.error(`Friendbot connection error: ${axiosError.message}`);
        throw new ServiceUnavailableException({
          code: ErrorCode.STEL_RPC_UNAVAILABLE,
          message: 'Unable to reach Friendbot. Please try again later.',
        });
      }

      this.logger.error(`Friendbot HTTP error ${tring(status)}: ${errorMsg}`);
      throw new HttpException(
        {
          code: ErrorCode.STEL_FRIENDBOT_FAILED,
          message: `Friendbot error: ${errorMsg}`,
        },
        status && status >= 400 && status < 600
          ? status
          : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (error instanceof Error) {
      this.logger.error(`Unexpected error calling Friendbot: ${error.message}`);
    }

    throw new HttpException(
      {
        code: ErrorCode.STEL_FRIENDBOT_FAILED,
        message: 'Unexpected error while funding account',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
