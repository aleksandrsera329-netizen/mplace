import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { TaxService } from '../tax.service';
import { CalculateTaxCommand } from './calculate-tax.command';

@Injectable()
@CommandHandler(CalculateTaxCommand)
export class CalculateTaxHandler
  implements ICommandHandler<CalculateTaxCommand>
{
  constructor(private readonly tax: TaxService) {}

  execute(cmd: CalculateTaxCommand) {
    return this.tax.calculate(cmd.tenantId, cmd.items, cmd.country);
  }
}
