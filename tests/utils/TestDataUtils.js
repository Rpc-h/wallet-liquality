const Wallet = require('ethereumjs-wallet')
const bitcoin = require('bitcoinjs-lib')

class TestDataUtils {
  /**
   * Generate Random address.
   * @param name - bitcoin name
   * @returns {string}
   */
  getRandomAddress (name) {
    switch (name) {
      case 'ethereum': {
        return this.getRandomEthereumAddress()
      }

      case 'bitcoin': {
        return this.getRandomBitcoinAddress()
      }

      default:
        throw Error(`Unsupported chain: ${name}`)
    }
  }

  /**
   * Generate random ETH address.
   * @returns {string}
   */
  getRandomEthereumAddress () {
    const EthWallet = Wallet.default.generate()
    return EthWallet.getAddressString()
  }

  /**
   * Generate bitcoin address for testnet.
   * @returns {*}
   */
  getRandomBitcoinAddress () {
    const keyPair = bitcoin.ECPair.makeRandom()
    const { address } = bitcoin.payments.p2pkh({
      pubkey: keyPair.publicKey,
      network: bitcoin.networks.testnet
    })
    return address
  }
}

module.exports = TestDataUtils