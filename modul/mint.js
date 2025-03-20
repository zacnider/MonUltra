const { ethers } = require("ethers");
require("dotenv").config();

const config = {
  contractAddress: "0x252390af40ab02C0B8D05Fe6f8BAe145C6F26989",
  rpcUrl: "https://testnet-rpc.monad.xyz",
  tokenId: 1,
  mintPrice: ethers.utils.parseEther("0.518"), // 0.518 MON wei cinsinden
  gasLimit: 300000
};

const contractABI = [
  "function mint(uint256 tokenId, address receiver)"
];

async function mintWithAllWallets() {
  const privateKeys = Object.entries(process.env)
    .filter(([key]) => key.startsWith("PRIVATE_KEY_"))
    .map(([, value]) => value)
    .filter(Boolean);

  if (privateKeys.length === 0) {
    console.error("Hata: .env dosyasında PRIVATE_KEY_* tanımlı değil");
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
  
  for (const [index, privateKey] of privateKeys.entries()) {
    const wallet = new ethers.Wallet(privateKey, provider);
    
    try {
      // Bakiye kontrolü
      const balance = await wallet.getBalance();
      const requiredBalance = config.mintPrice.add(
        ethers.utils.parseEther("0.001") // Gaz ücreti için ek bakiye
      );

      if (balance.lt(requiredBalance)) {
        console.log(`\n${index + 1}. Cüzdan (${wallet.address}) Yetersiz bakiye`);
        continue;
      }

      const contract = new ethers.Contract(
        config.contractAddress,
        contractABI,
        wallet
      );

      console.log(`\n${index + 1}. İşlem başlatılıyor: ${wallet.address}`);
      console.log(`  Mint Ücreti: 0.518 MON`);

      const tx = await contract.mint(
        config.tokenId,
        wallet.address,
        {
          value: config.mintPrice,
          gasLimit: config.gasLimit
        }
      );

      console.log(`  TX Hash: ${tx.hash}`);
      await tx.wait();
      console.log(`  Başarılı! Kalan Bakiye: ${ethers.utils.formatEther(balance.sub(config.mintPrice))} MON`);

    } catch (error) {
      console.error(`  Hata (${wallet.address}):`, error.message);
    }
  }
}

mintWithAllWallets();
