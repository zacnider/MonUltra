const { ethers } = require("ethers");
require("dotenv").config();

const config = {
  contractAddress: "0x252390af40ab02C0B8D05Fe6f8BAe145C6F26989",
  rpcUrl: "https://testnet-rpc.monad.xyz",
  tokenId: 1,
  mintPrice: ethers.utils.parseEther("0.518"), // 0.518 MON
  gasLimit: 300000,
  gasPrice: ethers.utils.parseUnits("1", "gwei") // Monad için gerekli olabilir
};

// PAYABLE EKLENMİŞ DOĞRU ABI
const contractABI = [
  "function mint(uint256 tokenId, address receiver) payable" 
];

async function mintWithAllWallets() {
  const privateKeys = Object.entries(process.env)
    .filter(([key, value]) => key.startsWith("PRIVATE_KEY_") && value)
    .map(([, value]) => value);

  if (privateKeys.length === 0) {
    console.error("Hata: .env dosyasında PRIVATE_KEY_* tanımlı değil");
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);

  for (const [index, privateKey] of privateKeys.entries()) {
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(config.contractAddress, contractABI, wallet);

    try {
      console.log(`\n${index + 1}. İşlem başlatılıyor: ${wallet.address}`);
      console.log(`  Mint Ücreti: ${ethers.utils.formatEther(config.mintPrice)} MON`);

      // Gas tahmini yap
      const estimatedGas = await contract.estimateGas.mint(
        config.tokenId,
        wallet.address,
        {
          value: config.mintPrice
        }
      );

      const tx = await contract.mint(
        config.tokenId,
        wallet.address,
        {
          value: config.mintPrice,
          gasLimit: estimatedGas.add(50000), // %10 buffer ekle
          gasPrice: config.gasPrice
        }
      );

      console.log(`  TX Hash: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`  Onaylandı! Blok: ${receipt.blockNumber}`);
      console.log(`  Kullanılan Gas: ${receipt.gasUsed.toString()}`);

    } catch (error) {
      console.error(`\n⚠️ Ciddi Hata (${wallet.address}):`);
      console.error(error.message);
      
      // Özel hata mesajları
      if (error.message.includes("insufficient funds")) {
        console.error("Çözüm: Cüzdan bakiyesini artırın");
      } else if (error.message.includes("invalid address")) {
        console.error("Çözüm: Kontrat adresini kontrol edin");
      } else {
        console.error("Bilinmeyen hata. Kontrat ABI'sını ve network bağlantısını kontrol edin");
      }
    }
  }
}

mintWithAllWallets();
