import { Component, OnInit, Inject } from '@angular/core';
import { Web3Enabled } from '../web3Enabled';
import { WEB3 } from '../web3';
import Web3 from 'web3';
@Component({
  selector: 'app-create',
  templateUrl: './create.component.html',
  styleUrls: ['./create.component.css']
})
export class CreateComponent extends Web3Enabled implements OnInit {
  DEV_ACCOUNT = '0x5f350bF5feE8e254D6077f8661E9C7B83a30364e';
  DEV_SUPPORT = 0.05; // 5% interest support developer

  tokenName: string;
  tokenSymbol: string;
  beneficiaryEthereumAccount: string;
  beneficiaryWeights: string;
  renounceOwnershipCheck: Boolean;
  devSupportCheck: Boolean;

  FACTORY_ADDRESS: string;

  createdPoolAddress: string;
  baseUrl: string;
  hasCreatedPool: Boolean;
  txHash: string;

  constructor(@Inject(WEB3) web3: Web3) {
    super(web3);

    this.tokenName = "";
    this.beneficiaryEthereumAccount = "";
    this.beneficiaryWeights = "";
    this.tokenSymbol = "";
    this.renounceOwnershipCheck = false;
    this.devSupportCheck = true;

    this.FACTORY_ADDRESS = "0xB72B4B94d1eD3Cc382D5beEEfE3d03dd55Ad8229";

    this.hasCreatedPool = false;
    this.createdPoolAddress = "";
    this.txHash = "";
  }

  ngOnInit() {
    this.baseUrl = window.location.origin;
  }

  async createPool() {
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
      const abi = require('../../assets/abi/MetadataPooledCDAIFactory.json');
      const factory = new self.web3.eth.Contract(abi, self.FACTORY_ADDRESS);

      // submit transaction
      this.createdPoolAddress = await factory.methods.createPCDAI(self.tokenName, self.tokenSymbol, beneficiaryList, self.renounceOwnershipCheck).call();
      self.sendTx(factory.methods.createPCDAI(self.tokenName, self.tokenSymbol, beneficiaryList, self.renounceOwnershipCheck), (hash) => {
        this.txHash = hash;
        this.hasCreatedPool = true;
      }, console.log, console.log);
    }, console.log, false);
  }
}
