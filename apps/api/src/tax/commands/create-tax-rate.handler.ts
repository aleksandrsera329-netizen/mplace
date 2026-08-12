import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { TaxService } from '../tax.service';
import { CreateTaxRateCommand } from './create-tax-rate.command';

@Injectable()
@CommandHandler(CreateTaxRateCommand)
export class CreateTaxRateHandler
  implements ICommandHandler<CreateTaxRateCommand>
{
  constructor(private readonly tax: TaxService) {}

  execute(cmd: CreateTaxRateCommand) {
    return this.tax.createRate(cmd.tenantId, cmd.data);
  }
}
