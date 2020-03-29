import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from "@angular/router";
import { ApolloAndWeb3Enabled } from '../apolloAndWeb3';
import { Apollo } from 'apollo-angular';
import gql from 'graphql-tag';
import { isUndefined, isNullOrUndefined } from 'util';
import Chart from 'chart.js';

import { Inject } from '@angular/core';
import { WEB3 } from '../web3';
import Web3 from 'web3';
import BigNumber from 'bignumber.js';
const fetch = require('node-fetch');

@Component({
  selector: 'app-pool',
  templateUrl: './pool.component.html',
  styleUrls: ['./pool.component.css']
})
// Damn Typescript for not supporting extending multiple classes
export class PoolComponent extends ApolloAndWeb3Enabled implements OnInit {
  DEV_ACCOUNT = '0x5f350bF5feE8e254D6077f8661E9C7B83a30364e';
  DEV_SUPPORT = 0.05; // 5% interest support developer

  isLoading: Boolean;
  poolData: any;
  totalSupplyHistoryChart: any;
  totalInterestWithdrawnHistoryChart: any;

  KYBER_EXT_ADDRESS: string;

  tokenData: any;

  depositAmount: number;
  depositTokenSymbol: string;
  withdrawAmount: number;
  withdrawTokenSymbol: string;

  currencyBalance: BigNumber;
  pDAIBalance: BigNumber;
  interestAccrued: BigNumber;

  beneficiaryEthereumAccount: string;
  beneficiaryWeights: string;
  devSupportCheck: Boolean;

  constructor(private route: ActivatedRoute, private apollo: Apollo, @Inject(WEB3) web3: Web3) {
    super(web3);

    this.KYBER_EXT_ADDRESS = "0x44FBF73a97cf50640A3208b883F810F730D80c2B";

    this.depositAmount = 0;
    this.depositTokenSymbol = 'ETH';
    this.withdrawAmount = 0;
    this.withdrawTokenSymbol = 'ETH';

    this.interestAccrued = new BigNumber(0);

    this.beneficiaryEthereumAccount = "";
    this.beneficiaryWeights = "";
    this.devSupportCheck = true;
  }

  async ngOnInit() {
    this.totalSupplyHistoryChart = new Chart('totalSupplyHistoryChart', {
      type: 'line',
      options: {
        scales: {
          xAxes: [{
            type: 'time',
            gridLines: {
              display: false
            }
          }],
          yAxes: [{
            gridLines: {
              display: false
            },
            scaleLabel: {
              display: true,
              labelString: "Pool size (DAI)"
            }
          }]
        },
        legend: {
          display: false
        }
      }
    });
    this.totalInterestWithdrawnHistoryChart = new Chart('totalInterestWithdrawnHistoryChart', {
      type: 'line',
      options: {
        scales: {
          xAxes: [{
            type: 'time',
            gridLines: {
              display: false
            }
          }],
          yAxes: [{
            gridLines: {
              display: false
            },
            scaleLabel: {
              display: true,
              labelString: "Total interest donated (DAI)"
            }
          }]
        },
        legend: {
          display: false
        }
      }
    });

    this.tokenData = await this.getKyberTokens();

    this.createQuery();
    this.displayInterestAccrued();
  }

  getPoolID() {
    return this.route.snapshot.paramMap.get("poolID");
  }

  createQuery() {
    let poolID = this.getPoolID();

    this.query = this.apollo.watchQuery({
      pollInterval: this.pollInterval,
      fetchPolicy: this.fetchPolicy,
      query: gql`
        {
          pool(id: "${poolID}") {
            totalSupply
            totalInterestWithdrawn
            name
            symbol
            creator
            creationTimestamp
            owner
            totalBeneficiaryWeight
            beneficiaries {
              dest
              weight
            }
            totalSupplyHistory {
              timestamp
              value
            }
            totalInterestWithdrawnHistory {
              timestamp
              value
            }
          }
        }
                `
    });
    this.querySubscription = this.query.valueChanges.subscribe((result) => this.handleQuery(result));
  }

  handleQuery({ data, loading }) {
    this.isLoading = isUndefined(loading) || loading;
    if (!this.isLoading) {
      this.poolData = data.pool;

      var gradientFill = this.totalSupplyHistoryChart.ctx.createLinearGradient(0, 0, 0, 200);
      gradientFill.addColorStop(0, 'rgba(0, 217, 126, 0.5)');
      gradientFill.addColorStop(0.5, 'rgba(0, 217, 126, 0.25)');
      gradientFill.addColorStop(1, 'rgba(0, 217, 126, 0)');

      this.totalSupplyHistoryChart.data = {
        labels: this.poolData.totalSupplyHistory.map((dp) => this.toDateObject(dp.timestamp)),
        datasets: [{
          data: this.poolData.totalSupplyHistory.map((dp) => dp.value),
          backgroundColor: gradientFill,
          borderColor: '#22c88a'
        }]
      };
      this.totalSupplyHistoryChart.update();

      this.totalInterestWithdrawnHistoryChart.data = {
        labels: this.poolData.totalInterestWithdrawnHistory.map((dp) => this.toDateObject(dp.timestamp)),
        datasets: [{
          data: this.poolData.totalInterestWithdrawnHistory.map((dp) => dp.value),
          backgroundColor: gradientFill,
          borderColor: '#22c88a'
        }]
      };
      this.totalInterestWithdrawnHistoryChart.update();
    }
  }

  refresh() {
    this.isLoading = true;

    this.query.refetch().then((result) => this.handleQuery(result));
    this.displayInterestAccrued();
  }

  withdrawInterest() {
    let self = this;
    this.connect(() => {
      // initialize contract instance
      const pcDAI = self.pcDAI();

      // submit transaction
      self.sendTx(pcDAI.methods.withdrawInterestInDAI(), console.log, console.log, console.log);
    }, console.log, false);
  }

  deposit(amount, tokenSymbol) {
    let self = this;
    let amountWithPrecision;
    this.connect(() => {
      // submit transaction
      switch (tokenSymbol) {
        case 'ETH':
          amountWithPrecision = new BigNumber(amount).times(1e18).integerValue().toFixed();
          self.sendTxWithValue(self.kyberExtension().methods.mintWithETH(self.getPoolID(), this.state.address), amountWithPrecision, console.log, console.log, console.log);
          break;
        case 'DAI':
          amountWithPrecision = new BigNumber(amount).times(1e18).integerValue().toFixed();
          self.sendTxWithToken(self.pcDAI().methods.mint(this.state.address, amountWithPrecision), self.ERC20(self.DAI_ADDR), self.getPoolID(), amountWithPrecision, 5e5, console.log, console.log, console.log);
          break;
        default:
          let data = this.tokenSymbolToData(tokenSymbol);
          if (isUndefined(data)) {
            console.error(`Invalid token symbol: ${tokenSymbol}`);
            break;
          }
          let tokenAddress = data.address;
          let tokenDecimals = data.decimals;
          amountWithPrecision = new BigNumber(amount).times(new BigNumber(10).pow(tokenDecimals)).integerValue().toFixed();
          let token = this.ERC20(tokenAddress);
          self.sendTxWithToken(self.kyberExtension().methods.mintWithToken(self.getPoolID(), tokenAddress, this.state.address, amountWithPrecision), token, self.KYBER_EXT_ADDRESS, amountWithPrecision, 2.5e6, console.log, console.log, console.log);
          break;
      }
    }, console.log, false);
  }

  withdraw(amount, tokenSymbol) {
    let self = this;
    let amountWithPrecision = new BigNumber(amount).times(1e18).integerValue().toFixed();
    this.connect(() => {
      // submit transaction
      let pcDAI = this.ERC20(this.getPoolID());
      switch (tokenSymbol) {
        case 'ETH':
          self.sendTxWithToken(self.kyberExtension().methods.burnToETH(self.getPoolID(), this.state.address, amountWithPrecision), pcDAI, self.KYBER_EXT_ADDRESS, amountWithPrecision, 1e6, console.log, console.log, console.log);
          break;
        case 'DAI':
          self.sendTx(self.pcDAI().methods.burn(this.state.address, amountWithPrecision), console.log, console.log, console.log);
          break;
        default:
          let data = this.tokenSymbolToData(tokenSymbol);
          if (isUndefined(data)) {
            console.error(`Invalid token symbol: ${tokenSymbol}`);
            break;
          }
          let tokenAddress = data.address;
          self.sendTxWithToken(self.kyberExtension().methods.burnToToken(self.getPoolID(), tokenAddress, this.state.address, amountWithPrecision), pcDAI, self.KYBER_EXT_ADDRESS, amountWithPrecision, 2e6, console.log, console.log, console.log);
          break;
      }
    }, console.log, false);
  }

  changeBeneficiaries() {
    // parse beneficiaryList
    let beneficiaryDestList = this.beneficiaryEthereumAccount.replace(/ /g, '').split(',');
    let beneficiaryWeightList = this.beneficiaryWeights.replace(/ /g, '').split(',');
    let beneficiaryList = beneficiaryDestList.map((x, i) => {
      return {
        dest: x,
        weight: beneficiaryWeightList[i]
      };
    });
    if (this.devSupportCheck) {
      let totalBeneficiaryWeight = 0;
      for (const b of beneficiaryList) {
        totalBeneficiaryWeight += +b.weight;
      }
      const devWeight = Math.floor(totalBeneficiaryWeight / (1 - this.DEV_SUPPORT) * this.DEV_SUPPORT);
      beneficiaryList.push({
        dest: this.DEV_ACCOUNT,
        weight: devWeight.toString()
      });
    }

    let self = this;
    this.connect(async () => {
      // initialize contract instance
      const abi = require('../../assets/abi/PooledCDAI.json');
      const pool = new self.web3.eth.Contract(abi, self.getPoolID());

      self.sendTx(pool.methods.setBeneficiaries(beneficiaryList), console.log, console.log, console.log);
    }, console.log, false);
  }

  displayCurrencyBalance() {
    let self = this;
    this.connect(async () => {
      if (self.depositTokenSymbol === 'ETH') {
        self.currencyBalance = new BigNumber(await self.web3.eth.getBalance(this.state.address)).div(1e18);
      } else {
        let data = self.tokenSymbolToData(self.depositTokenSymbol);
        if (!isUndefined(data)) {
          let token = self.ERC20(data.address);
          self.currencyBalance = new BigNumber(await token.methods.balanceOf(this.state.address).call()).div(new BigNumber(10).pow(data.decimals));
        }
      }
    }, console.log, false);
  }

  displayPDAIBalance() {
    let self = this;
    this.connect(async () => {
      let token = self.pcDAI();
      self.pDAIBalance = new BigNumber(await token.methods.balanceOf(this.state.address).call()).div(1e18);
    }, console.log, false);
  }

  async displayInterestAccrued() {
    let web3Instance = new Web3(`wss://mainnet.infura.io/ws/v3/${this.infuraKey}`);
    let token = this.pcDAI(web3Instance);
    this.interestAccrued = new BigNumber(await token.methods.accruedInterestCurrent().call()).div(1e18);
  }

  // Kyber utilities
  async httpsGet(apiStr) {
    const request = await fetch(apiStr, { headers: { 'Origin': 'https://zeframlou.github.io/pool-dai/' } });
    return await request.json();
  };

  async getKyberTokens() {
    // fetch token data from Kyber API
    let rawData = (await this.httpsGet('https://api.kyber.network/currencies') as any).data;
    let tokenData = rawData.map((x) => {
      return {
        name: x.name,
        symbol: x.symbol,
        address: this.web3.utils.toChecksumAddress(x.address),
        decimals: x.decimals
      }
    });
    return tokenData;
  }

  tokenSymbolToData(symbol) {
    return this.tokenData.find((x) => x.symbol === symbol);
  }

  // web3 utilities
  ERC20(_tokenAddr) {
    // add new token contract
    var erc20ABI = require("../../assets/abi/ERC20.json");
    return new this.web3.eth.Contract(erc20ABI, _tokenAddr);
  };

  pcDAI(web3Instance?) {
    const abi = require('../../assets/abi/PooledCDAI.json');
    if (isNullOrUndefined(web3Instance)) {
      // use default
      return new this.web3.eth.Contract(abi, this.getPoolID());
    } else {
      // use given web3 instance
      return new web3Instance.eth.Contract(abi, this.getPoolID());
    }
  }

  kyberExtension() {
    let abi = require('../../assets/abi/PooledCDAIKyberExtension.json');
    let contract = new this.web3.eth.Contract(abi, this.KYBER_EXT_ADDRESS);
    return contract;
  }
}