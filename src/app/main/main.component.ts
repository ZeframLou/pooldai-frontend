import { Component, OnInit } from '@angular/core';
import { ApolloAndWeb3Enabled } from '../apolloAndWeb3';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { isUndefined } from 'util';

import { Inject } from '@angular/core';
import { WEB3 } from '../web3';
import Web3 from 'web3';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent extends ApolloAndWeb3Enabled implements OnInit {

  isLoading: Boolean;
  poolList: Array<any>;

  orderBy: string;
  orderDirection: string;
  searchEntry: string;
  isSearching: Boolean;

  // pagination
  startFrom: number;
  pageSize: number;
  numPools: number;

  constructor(private apollo: Apollo, @Inject(WEB3) web3: Web3) {
    super(web3);

    this.isLoading = true;
    this.poolList = new Array<any>();

    this.orderBy = 'totalSupply';
    this.orderDirection = 'desc';
    this.searchEntry = '';
    this.isSearching = false;

    this.startFrom = 0;
    this.pageSize = 25;
    this.numPools = 25;
  }

  ngOnInit() {
    this.createQuery();
  }

  createQuery() {
    this.query = this.apollo.watchQuery({
      pollInterval: this.pollInterval,
      fetchPolicy: this.fetchPolicy,
      query: gql`
        {
          pools(orderBy: ${this.orderBy}, orderDirection: ${this.orderDirection}, where: { name_contains: "${this.searchEntry}" }, skip: ${this.startFrom}, first: ${this.pageSize}) {
            id
            totalSupply
            totalInterestWithdrawn
            name
          }
          registry(id: "0") {
            numPools
          }
        }
                `
    });
    this.querySubscription = this.query.valueChanges.subscribe((result) => this.handleQuery(result));
  }

  handleQuery({ data, loading }) {
    this.isLoading = isUndefined(loading) || loading;
    if (!this.isLoading) {
      this.poolList = data.pools;
      this.numPools = this.isSearching ? data.pools.length : +data.registry.numPools;
    }
  }

  refresh() {
    this.isLoading = true;

    this.query.refetch().then((result) => this.handleQuery(result));
  }

  reloadQuery() {
    this.querySubscription.unsubscribe();
    this.createQuery();
  }

  sortBy(property) {
    if (property === this.orderBy) {
      // switch direction
      this.orderDirection = (this.orderDirection === 'desc') ? 'asc' : 'desc';
    }
    this.orderBy = property;

    this.reloadQuery();
  }

  search() {
    this.isSearching = this.searchEntry !== '';
    this.startFrom = 0;

    this.reloadQuery();
  }

  numPages() {
    return Math.ceil(this.numPools / this.pageSize);
  }

  currentPage() {
    return Math.ceil(this.startFrom / this.pageSize) + 1;
  }

  getPageNumberList() {
    return Array(this.numPages()).keys(); // 0 indexed
  }

  goToPage(page) {
    if (page < 1 || page > this.numPages()) {
      return;
    }

    this.startFrom = (page - 1) * this.pageSize;

    this.reloadQuery();
  }
}
