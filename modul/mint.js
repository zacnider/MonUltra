const { ethers } = require("ethers");
require("dotenv").config();

// Kontrat ve ağ ayarları
const config = {
  contractAddress: "0x252390af40ab02C0B8D05Fe6f8BAe145C6F26989",
  rpcUrl: "https://testnet-rpc.monad.xyz",
  tokenId: 1
};

// ABI tanımı
const contractABI = [
  "function mint(uint256 tokenId, address receiver)"
];

async function mintWithAllWallets() {
  // .env'den tüm private key'leri al
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
    try {
      const wallet = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(
        config.contractAddress,
        contractABI,
        wallet
      );

      console.log(`\n${index + 1}. Cüzdan işlemi başlatılıyor: ${wallet.address}`);

      const tx = await contract.mint(
        config.tokenId,
        wallet.address, // Receiver olarak cüzdanın kendi adresi
        {
          value: 0,
          gasLimit: 300000
        }
      );

      console.log(`  TX Hash: ${tx.hash}`);
      await tx.wait();
      console.log(`  ${wallet.address} başarılı!`);

    } catch (error) {
      console.error(`  Hata (${privateKey.slice(-6)}...):`, error.message);
    }
  }
}

mintWithAllWallets();
