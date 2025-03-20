const { ethers } = require("ethers");
require("dotenv").config();

const config = {
  contractAddress: "0x252390af40ab02C0B8D05Fe6f8BAe145C6F26989",
  rpcUrl: "https://testnet-rpc.monad.xyz",
  tokenId: 1,
  mintPrice: ethers.utils.parseEther("0.518"),
  gasLimit: 300000, // Artırılmış gas limit
  priorityMultiplier: 1.2 // Gas fiyatı için %20 buffer
};

const contractABI = [
  "function mint(uint256 tokenId, address receiver) payable"
];

async function mintWithAllWallets() {
  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  
  // Dinamik gas fiyatı al
  const feeData = await provider.getFeeData();
  const adjustedGasPrice = feeData.gasPrice.mul(Math.floor(config.priorityMultiplier * 100)).div(100);

  const privateKeys = Object.entries(process.env)
    .filter(([key]) => key.startsWith("PRIVATE_KEY_"))
    .map(([, value]) => value);

  for (const [index, privateKey] of privateKeys.entries()) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(config.contractAddress, contractABI, wallet);

    try {
      console.log(`\n${index + 1}. İşlem başlatılıyor: ${wallet.address}`);
      
      const tx = await contract.mint(
        config.tokenId,
        wallet.address,
        {
          value: config.mintPrice,
          gasLimit: config.gasLimit,
          maxFeePerGas: adjustedGasPrice,
          maxPriorityFeePerGas: adjustedGasPrice
        }
      );

      console.log(`✅ TX Hash: ${tx.hash}`);
      await tx.wait();
      console.log(`⛏ Blok Onaylandı!`);

    } catch (error) {
      console.error(`\n💥 Hata Detayları (${wallet.address}):`);
      console.error(error.code, "-", error.message);
      
      // Özel çözüm önerileri
      if(error.code === "SERVER_ERROR") {
        console.log("Çözüm Deneyin:");
        console.log("1. Gas fiyatını %50 artırın (priorityMultiplier: 1.5)");
        console.log("2. Farklı RPC URL kullanın");
        console.log("3. 5-10 dakika sonra tekrar deneyin");
      }
    }
  }
}

mintWithAllWallets();
