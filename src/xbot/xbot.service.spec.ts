import { Test, TestingModule } from '@nestjs/testing';
import { XbotService } from './xbot.service';

describe('XbotService', () => {
  let service: XbotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [XbotService],
    }).compile();

    service = module.get<XbotService>(XbotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
