import { Subscription } from 'apollo-client/util/Observable';
import { OnDestroy } from '@angular/core';
import { BigNumber } from 'bignumber.js';
import { isNullOrUndefined } from 'util';
import { Web3Enabled } from './web3Enabled';
import Web3 from 'web3';

export class ApolloAndWeb3Enabled extends Web3Enabled implements OnDestroy {
  querySubscription: Subscription;
  query: any;

  pollInterval: number;
  fetchPolicy: any;

  defaultLogoUrl: string;

  constructor(public web3: Web3) {
    super(web3);

    this.pollInterval = 60000;
    this.defaultLogoUrl = 'assets/img/no-logo-asset.svg';
    this.fetchPolicy = 'cache-and-network';
  }

  ngOnDestroy() {
    this.unsubQuery();
  }

  unsubQuery() {
    if (!isNullOrUndefined(this.querySubscription)) {
      this.querySubscription.unsubscribe();
    }
  }

  toBigNumber(n) {
    return new BigNumber(n);
  }

  toDateTimeString(unixTimestamp) {
    return new Date(+unixTimestamp * 1e3).toLocaleString();
  }

  toDateString(unixTimestamp) {
    return new Date(+unixTimestamp * 1e3).toLocaleDateString();
  }

  toDateObject(unixTimestamp) {
    return new Date(+unixTimestamp * 1e3);
  }
}