import { Injectable, Logger, PayloadTooLargeException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import * as net from 'net';

/**
 * Stage 24 — optional ClamAV (clamd INSTREAM) virus scan.
 *
 * Enable with:
 *   CLAMAV_ENABLED=true
 *   CLAMAV_HOST=127.0.0.1
 *   CLAMAV_PORT=3310
 *
 * When disabled, scan is a no-op (always clean).
 */
@Injectable()
export class VirusScanService {
  private readonly logger = new Logger(VirusScanService.name);
  private readonly enabled: boolean;
  private readonly host: string;
  private readonly port: number;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.enabled =
      config.get<string>('CLAMAV_ENABLED') === 'true' ||
      config.get<string>('CLAMAV_ENABLED') === '1';
    this.host = config.get<string>('CLAMAV_HOST') || '127.0.0.1';
    this.port = Number(config.get<string>('CLAMAV_PORT') || 3310);
    this.timeoutMs = Number(config.get<string>('CLAMAV_TIMEOUT_MS') || 15_000);
  }

  get isEnabled() {
    return this.enabled;
  }

  /**
   * Scan buffer via clamd INSTREAM protocol.
   * @throws BadRequestException if infected
   */
  async scanBuffer(buffer: Buffer, label = 'upload'): Promise<{ clean: boolean; raw?: string }> {
    if (!this.enabled) {
      return { clean: true };
    }
    if (!buffer?.length) {
      throw new BadRequestException('Empty file');
    }
    // clamd default StreamMaxLength is often 25MB — guard early
    if (buffer.length > 25 * 1024 * 1024) {
      throw new PayloadTooLargeException('File too large for virus scan');
    }

    try {
      const raw = await this.clamdInstream(buffer);
      const infected = /FOUND/i.test(raw) && !/OK/i.test(raw.split('\n').pop() || '');
      // clamd replies: "stream: OK" or "stream: Eicar-Test-Signature FOUND"
      if (/FOUND/i.test(raw)) {
        this.logger.warn(`ClamAV infected ${label}: ${raw.trim()}`);
        throw new BadRequestException('File failed virus scan');
      }
      if (!/OK/i.test(raw)) {
        this.logger.warn(`ClamAV unexpected response for ${label}: ${raw}`);
        // Fail closed in production when enabled
        throw new BadRequestException('Virus scan failed');
      }
      return { clean: true, raw: raw.trim() };
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error(
        `ClamAV scan error for ${label}: ${e instanceof Error ? e.message : e}`,
      );
      throw new BadRequestException(
        'Virus scan unavailable — upload rejected (CLAMAV_ENABLED)',
      );
    }
  }

  private clamdInstream(buffer: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = net.createConnection(
        { host: this.host, port: this.port },
        () => {
          // zINSTREAM\0 then chunks: 4-byte big-endian length + data, then 0 length
          socket.write(Buffer.from('zINSTREAM\0', 'utf8'));
          const chunkSize = 2048;
          for (let i = 0; i < buffer.length; i += chunkSize) {
            const slice = buffer.subarray(i, Math.min(i + chunkSize, buffer.length));
            const len = Buffer.alloc(4);
            len.writeUInt32BE(slice.length, 0);
            socket.write(len);
            socket.write(slice);
          }
          const end = Buffer.alloc(4);
          end.writeUInt32BE(0, 0);
          socket.write(end);
        },
      );

      let data = '';
      const timer = setTimeout(() => {
        socket.destroy();
        reject(new Error(`ClamAV timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      socket.setEncoding('utf8');
      socket.on('data', (chunk) => {
        data += chunk;
      });
      socket.on('end', () => {
        clearTimeout(timer);
        resolve(data);
      });
      socket.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}
