import { Module } from '@nestjs/common';
import { RfqController } from './rfq.controller';
import { RfqService } from './rfq.service';
import { CreateRfqHandler } from './commands/create-rfq.handler';
import { RespondToRfqHandler } from './commands/respond-to-rfq.handler';
import { AcceptRfqResponseHandler } from './commands/accept-rfq-response.handler';
import { RejectRfqResponseHandler } from './commands/reject-rfq-response.handler';
import { CloseRfqHandler } from './commands/close-rfq.handler';
import { RfqCreatedHandler } from './events/rfq-created.handler';
import { RfqResponseCreatedHandler } from './events/rfq-response-created.handler';
import { RfqResponseAcceptedHandler } from './events/rfq-response-accepted.handler';
import { RfqResponseRejectedHandler } from './events/rfq-response-rejected.handler';
import { RfqClosedHandler } from './events/rfq-closed.handler';

@Module({
  controllers: [RfqController],
  providers: [
    RfqService,
    CreateRfqHandler,
    RespondToRfqHandler,
    AcceptRfqResponseHandler,
    RejectRfqResponseHandler,
    CloseRfqHandler,
    RfqCreatedHandler,
    RfqResponseCreatedHandler,
    RfqResponseAcceptedHandler,
    RfqResponseRejectedHandler,
    RfqClosedHandler,
  ],
  exports: [RfqService],
})
export class RfqModule {}
