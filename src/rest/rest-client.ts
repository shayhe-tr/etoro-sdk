import type { EToroConfigWithLogger } from '../config/config';
import { HttpClient } from '../http/http-client';
import { MarketDataClient } from './market-data.client';
import { TradingExecutionClient } from './trading-execution.client';
import { TradingInfoClient } from './trading-info.client';
import { FeedsClient } from './feeds.client';
import { ReactionsClient } from './reactions.client';
import { DiscoveryClient } from './discovery.client';
import { PiDataClient } from './pi-data.client';
import { WatchlistsClient } from './watchlists.client';
import { UsersInfoClient } from './users-info.client';

export class RestClient {
  public readonly marketData: MarketDataClient;
  public readonly execution: TradingExecutionClient;
  public readonly info: TradingInfoClient;
  public readonly feeds: FeedsClient;
  public readonly reactions: ReactionsClient;
  public readonly discovery: DiscoveryClient;
  public readonly piData: PiDataClient;
  public readonly watchlists: WatchlistsClient;
  public readonly usersInfo: UsersInfoClient;

  constructor(config: EToroConfigWithLogger) {
    const http = new HttpClient(config);
    const mode = config.mode;

    this.marketData = new MarketDataClient(http);
    this.execution = new TradingExecutionClient(http, mode);
    this.info = new TradingInfoClient(http, mode);
    this.feeds = new FeedsClient(http);
    this.reactions = new ReactionsClient(http);
    this.discovery = new DiscoveryClient(http);
    this.piData = new PiDataClient(http);
    this.watchlists = new WatchlistsClient(http);
    this.usersInfo = new UsersInfoClient(http);
  }
}
