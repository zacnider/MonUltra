require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");
const cfonts = require("cfonts");
const displayHeader = require("../src/banner.js");

displayHeader();

// RPC ve contract bilgileri
const RPC_URLS = [
  "https://testnet-rpc.monad.xyz",
  "https://monad-testnet.drpc.org"
];
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";
const WMON_CONTRACT = "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701";

// Çoklu cüzdan desteği için private key'leri yükle
function loadPrivateKeys() {
  const privateKeys = [];
  
  // Tüm PRIVATE_KEY_ ile başlayan değişkenleri bul
  Object.keys(process.env).forEach(key => {
    if (key.startsWith('PRIVATE_KEY_')) {
      privateKeys.push({
        name: key,
        value: process.env[key]
      });
    }
  });
  
  // Eğer hiç private key bulunamazsa, PRIVATE_KEY'i kontrol et
  if (privateKeys.length === 0 && process.env.PRIVATE_KEY) {
    privateKeys.push({
      name: "PRIVATE_KEY",
      value: process.env.PRIVATE_KEY
    });
  }
  
  if (privateKeys.length === 0) {
    console.error(colors.red("❌ No private keys found in .env file"));
    process.exit(1);
  }
  
  console.log(colors.green(`✅ Loaded ${privateKeys.length} wallet(s) from .env file`));
  return privateKeys;
}

// RPC'ye bağlan
async function connectToRpc() {
  for (const url of RPC_URLS) {
    try {
      console.log(colors.yellow(`🔄 Trying to connect to RPC: ${url}`));
      const provider = new ethers.providers.JsonRpcProvider(url);
      
      // Timeout ekleyin (10 saniye)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
      );
      
      const networkPromise = provider.getNetwork();
      
      // İlk tamamlanan promise'i bekle
      await Promise.race([networkPromise, timeoutPromise]);
      
      console.log(colors.green(`✅ Connected to RPC: ${url}`));
      return provider;
    } catch (error) {
      console.log(colors.red(`❌ Failed to connect to ${url}: ${error.message}`));
    }
  }
  throw new Error(colors.red(`❌ Unable to connect to any RPC URL. Please check your internet connection or RPC endpoints.`));
}

// Cüzdan bakiyesini kontrol et
async function checkBalance(wallet) {
  const balance = await wallet.provider.getBalance(wallet.address);
  console.log(colors.cyan(`💰 MON Balance: ${ethers.utils.formatEther(balance)} MON`));
  return balance;
}

// Random miktar üret
function getRandomAmount() {
  const min = 0.01;
  const max = 0.05;
  const randomAmount = Math.random() * (max - min) + min;
  return ethers.utils.parseEther(randomAmount.toFixed(4));
}

// Random bekleme süresi üret
function getRandomDelay(min = 60, max = 180 ) {
  // min ve max değerleri saniye cinsinden
  return Math.floor(Math.random() * (max * 1000 - min * 1000 + 1) + min * 1000);
}

// MON'u wrap et
async function wrapMON(wallet, amount) {
  try {
    const contract = new ethers.Contract(
      WMON_CONTRACT,
      [
        "function deposit() public payable",
        "function withdraw(uint256 amount) public",
        "function balanceOf(address account) view returns (uint256)"
      ],
      wallet
    );
    
    console.log(` `);
    console.log(`🔄 Wrap ${ethers.utils.formatEther(amount)} MON > WMON`.magenta);
    
    // Gas fiyatını optimize et
    const baseGasPrice = await wallet.provider.getGasPrice();
    const gasPrice = baseGasPrice.mul(110).div(100); // %10 artır
    
    const tx = await contract.deposit({ 
      value: amount, 
      gasLimit: 100000,
      gasPrice: gasPrice
    });
    
    console.log(`✅ Wrap MON > WMON transaction sent`.green);
    console.log(`➡️  Hash: ${tx.hash}`.yellow);
    console.log(`🔍 Explorer: ${EXPLORER_URL}${tx.hash}`.cyan);
    
    await tx.wait();
    console.log(`✅ Wrap MON > WMON confirmed`.green);
    
    // WMON bakiyesini kontrol et
    const wmonBalance = await contract.balanceOf(wallet.address);
    console.log(colors.cyan(`🪙 WMON Balance: ${ethers.utils.formatEther(wmonBalance)} WMON`));
    
    return wmonBalance;
  } catch (error) {
    console.error(`❌ Error wrap MON:`.red, error.message);
    return ethers.BigNumber.from(0);
  }
}

// WMON'u unwrap et
async function unwrapMON(wallet, amount) {
  try {
    const contract = new ethers.Contract(
      WMON_CONTRACT,
      [
        "function deposit() public payable",
        "function withdraw(uint256 amount) public",
        "function balanceOf(address account) view returns (uint256)"
      ],
      wallet
    );
    
    console.log(`🔄 Unwrap ${ethers.utils.formatEther(amount)} WMON > MON`.magenta);
    
    // Gas fiyatını optimize et
    const baseGasPrice = await wallet.provider.getGasPrice();
    const gasPrice = baseGasPrice.mul(110).div(100); // %10 artır
    
    const tx = await contract.withdraw(amount, { 
      gasLimit: 100000,
      gasPrice: gasPrice
    });
    
    console.log(`✅ Unwrap WMON > MON transaction sent`.green);
    console.log(`➡️  Hash: ${tx.hash}`.yellow);
    console.log(`🔍 Explorer: ${EXPLORER_URL}${tx.hash}`.cyan);
    
    await tx.wait();
    console.log(`✅ Unwrap WMON > MON confirmed`.green);
    
    // Son bakiyeleri kontrol et
    const wmonBalance = await contract.balanceOf(wallet.address);
    console.log(colors.cyan(`🪙 WMON Balance: ${ethers.utils.formatEther(wmonBalance)} WMON`));
    
    const monBalance = await wallet.provider.getBalance(wallet.address);
    console.log(colors.cyan(`💰 MON Balance: ${ethers.utils.formatEther(monBalance)} MON`));
    
    return true;
  } catch (error) {
    console.error(`❌ Error unwrapping WMON:`.red, error.message);
    return false;
  }
}

// Tek bir cüzdan için swap döngüsü
async function runSwapCycle(wallet, walletName, cycles = 1) {
  console.log(`\n${"=".repeat(50)}`);
  console.log(colors.cyan.bold(`👤 Processing wallet: ${walletName}`));
  console.log(colors.green(`🧧 Account: ${wallet.address}`));
  
  // Başlangıç bakiyesini kontrol et
  const initialBalance = await checkBalance(wallet);
  
  // Minimum bakiye kontrolü (0.06 MON)
  if (initialBalance.lt(ethers.utils.parseEther("0.06"))) {
    console.log(colors.yellow(`⚠️ Insufficient balance for operations. Need at least 0.06 MON.`));
    return false;
  }
  
  let success = true;
  
  for (let i = 0; i < cycles; i++) {
    console.log(colors.blue(`\n🔄 Cycle ${i+1}/${cycles}`));
    
    // Random miktar
    const randomAmount = getRandomAmount();
    
    // MON'u wrap et
    const wrappedAmount = await wrapMON(wallet, randomAmount);
    
    // Eğer wrap işlemi başarısız olduysa veya wrap edilen miktar 0 ise döngüyü sonlandır
    if (wrappedAmount.eq(0)) {
      success = false;
      console.log(colors.red(`❌ Wrap operation failed, skipping unwrap.`));
      break;
    }
    
    // Biraz bekle
    const shortDelay = getRandomDelay(10, 30); // 10-30 saniye
    console.log(`⏳ Waiting ${Math.floor(shortDelay/1000)} seconds before unwrap...`.grey);
    await new Promise((resolve) => setTimeout(resolve, shortDelay));
    
    // WMON'u unwrap et
    const unwrapSuccess = await unwrapMON(wallet, wrappedAmount);
    if (!unwrapSuccess) {
      success = false;
      console.log(colors.red(`❌ Unwrap operation failed.`));
      break;
    }
    
    // Son döngü değilse bekle
    if (i < cycles - 1) {
      const randomDelay = getRandomDelay(60, 180); // 1-3 dakika
      console.log(`⏳ Wait ${(randomDelay / 1000 / 60).toFixed(2)} minutes before next cycle`.grey);
      await new Promise((resolve) => setTimeout(resolve, randomDelay));
    }
  }
  
  console.log(colors.green(`✅ Wallet ${walletName} operations completed with ${success ? 'success' : 'some errors'}`));
  return success;
}

// Ana fonksiyon
async function main() {
  try {
    console.log(`🪫  Starting Rubic ⏩⏩⏩⏩`.blue);
    
    // Provider'a bağlan
    const provider = await connectToRpc();
    
    // Private key'leri yükle
    const privateKeys = loadPrivateKeys();
    
    console.log(colors.cyan.bold(`🚀 Starting Rubic operations with ${privateKeys.length} wallets`));
    
    let successCount = 0;
    let failCount = 0;
    
    // Her cüzdan için işlem yap
    for (let i = 0; i < privateKeys.length; i++) {
      // Cüzdanı oluştur
      const wallet = new ethers.Wallet(privateKeys[i].value, provider);
      
      // Her cüzdan için 1-3 arası rastgele swap döngüsü
      const cycles = Math.floor(Math.random() * 3) + 1;
      
      // İşlemleri gerçekleştir
      const success = await runSwapCycle(wallet, privateKeys[i].name, cycles);
      
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Son cüzdan değilse, cüzdanlar arası bekleme süresi ekle
      if (i < privateKeys.length - 1) {
        const delay = getRandomDelay(180, 300); // 3-5 dakika arası
        console.log(colors.yellow(`\n⏳ Waiting ${(delay/1000/60).toFixed(2)} minutes before processing next wallet...`));
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    console.log(`\n${"=".repeat(50)}`);
    console.log(colors.green.bold(`🎉 All operations completed!`));
    console.log(colors.cyan(`📊 Summary: ${successCount} successful, ${failCount} failed`));
    
  } catch (error) {
    console.error(colors.red(`❌ Main function error: ${error.message}`));
  }
}

// Programı çalıştır
main().catch(error => {
  console.error(colors.red(`❌ Unhandled error:`), error);
});
