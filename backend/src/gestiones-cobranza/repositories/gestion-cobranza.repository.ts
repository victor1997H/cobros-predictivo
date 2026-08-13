import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { GestionCobranza } from '../entities/gestion-cobranza.entity';

@Injectable()
export class GestionCobranzaRepository {
  constructor(
    @InjectRepository(GestionCobranza)
    private readonly repository: Repository<GestionCobranza>,
  ) {}

  findAll(): Promise<GestionCobranza[]> {
    return this.repository.find({
      relations: {
        cuota: {
          prestamo: {
            cliente: true,
          },
        },
      },
      order: {
        createdAt: 'DESC',
      },
    });
  }

  findByClaveGestion(claveGestion: string): Promise<GestionCobranza | null> {
    return this.repository.findOne({
      where: { claveGestion },
      relations: {
        cuota: {
          prestamo: {
            cliente: true,
          },
        },
      },
    });
  }

  create(data: DeepPartial<GestionCobranza>): GestionCobranza {
    return this.repository.create(data);
  }

  save(gestion: GestionCobranza): Promise<GestionCobranza> {
    return this.repository.save(gestion);
  }
}
