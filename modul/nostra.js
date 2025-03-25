require("dotenv").config();
const { ethers } = require("ethers");
const colors = require("colors");

// ########################################
// ##         KONFİGÜRASYON            ##
// ########################################
const CONFIG = {
  RPC_URL: "https://testnet-rpc.monad.xyz/",
  WMON_CONTRACT: "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701",
  TARGET_CONTRACT: "0x4130c5F6F9F8A29DC2f421b0c5f02b983F83B2F0",
  MIN_WRAP: 0.01,
  MAX_WRAP: 0.05,
  WITHDRAW_PERCENTAGE: 95,
  GAS_PRICE: ethers.utils.parseUnits("60", "gwei"),
  GAS_LIMIT: 300000,
  WAIT_TIME: 15000,
  MIN_WAIT: 30000,
  MAX_WAIT: 60000
};

// ########################################
// ##           ABI TANIMLARI          ##
// ########################################
const WMON_ABI = [
  "function deposit() public payable",
  "function balanceOf(address owner) public view returns (uint256)",
  "function approve(address spender, uint256 amount) public returns (bool)"
];

const TARGET_ABI = [
  "function deposit(address user, uint256 amount) external",
  "function withdraw(address, address, uint256) external",
  "function balanceOf(address) view returns (uint256)"
];

const provider = new ethers.providers.JsonRpcProvider(CONFIG.RPC_URL);

// ########################################
// ##       CÜZDAN YÖNETİMİ           ##
// ########################################
function getWalletsFromEnv() {
  const wallets = [];
  let index = 1;
  
  while (process.env[`PRIVATE_KEY_${index}`]) {
    const privateKey = process.env[`PRIVATE_KEY_${index}`];
    if (privateKey?.trim()) wallets.push({ privateKey: privateKey.trim() });
    index++;
  }
  return wallets;
}

// ########################################
// ##     RASTGELE DEĞER ÜRETİCİLERİ   ##
// ########################################
function getRandomAmount() {
  const random = Math.random() * (CONFIG.MAX_WRAP - CONFIG.MIN_WRAP) + CONFIG.MIN_WRAP;
  return parseFloat(random.toFixed(4));
}

function randomWait(walletIndex) {
  const waitTime = Math.floor(Math.random() * (CONFIG.MAX_WAIT - CONFIG.MIN_WAIT)) + CONFIG.MIN_WAIT;
  console.log(`⏳ [Cüzdan ${walletIndex + 1}] Bekleme Süresi: ${waitTime/1000} sn`.yellow);
  return new Promise(resolve => setTimeout(resolve, waitTime));
}

// ########################################
// ##       WMON İŞLEM FONKSİYONLARI   ##
// ########################################
async function wrapMON(wallet, amount, walletIndex) {
  try {
    const connectedWallet = new ethers.Wallet(wallet.privateKey, provider);
    const contract = new ethers.Contract(CONFIG.WMON_CONTRACT, WMON_ABI, connectedWallet);
    
    console.log(`🌀 [Cüzdan ${walletIndex + 1}] MON ➞ WMON Dönüşümü`.cyan);
    console.log(`🎲 Rastgele Miktar: ${amount} MON`.magenta);
    
    const tx = await contract.deposit({ 
      value: ethers.utils.parseEther(amount.toString()),
      gasLimit: 210000 
    });
    
    await tx.wait();
    console.log(`✅ Başarılı | TX: ${tx.hash}`.green);
    return true;
  } catch (error) {
    console.error(`❌ Hata: ${error.code || error.message}`.red);
    return false;
  }
}

async function checkWMONBalance(wallet, walletIndex) {
  try {
    const connectedWallet = new ethers.Wallet(wallet.privateKey, provider);
    const contract = new ethers.Contract(CONFIG.WMON_CONTRACT, WMON_ABI, provider);
    
    const balance = await contract.balanceOf(connectedWallet.address);
    return ethers.utils.formatEther(balance);
  } catch (error) {
    console.error(`❌ Bakiye Kontrol Hatası: ${error.message}`.red);
    return "0";
  }
}

// ########################################
// ##    HEDEF KONTRAKT İŞLEMLERİ     ##
// ########################################
async function depositToTarget(wallet, amount, walletIndex) {
  try {
    const connectedWallet = new ethers.Wallet(wallet.privateKey, provider);
    
    // Onay İşlemi
    const wmonContract = new ethers.Contract(CONFIG.WMON_CONTRACT, WMON_ABI, connectedWallet);
    const approveTx = await wmonContract.approve(
      CONFIG.TARGET_CONTRACT,
      ethers.utils.parseEther(amount.toString()),
      { gasLimit: 100000 }
    );
    await approveTx.wait();
    
    // Deposit İşlemi
    const targetContract = new ethers.Contract(CONFIG.TARGET_CONTRACT, TARGET_ABI, connectedWallet);
    const tx = await targetContract.deposit(
      connectedWallet.address,
      ethers.utils.parseEther(amount.toString()),
      { gasLimit: CONFIG.GAS_LIMIT }
    );
    
    console.log(`📥 [Cüzdan ${walletIndex + 1}] Deposit Başarılı`.green);
    console.log(`💳 Miktar: ${amount} WMON`.magenta);
    return tx.wait();
  } catch (error) {
    console.error(`❌ Deposit Hatası: ${error.message}`.red);
    return null;
  }
}

async function withdrawFromTarget(wallet, amount, walletIndex) {
  try {
    const connectedWallet = new ethers.Wallet(wallet.privateKey, provider);
    const targetContract = new ethers.Contract(CONFIG.TARGET_CONTRACT, TARGET_ABI, connectedWallet);
    
    const tx = await targetContract.withdraw(
      connectedWallet.address,
      connectedWallet.address,
      ethers.utils.parseEther(amount.toString()),
      {
        gasPrice: CONFIG.GAS_PRICE,
        gasLimit: CONFIG.GAS_LIMIT
      }
    );
    
    console.log(`📤 [Cüzdan ${walletIndex + 1}] %${CONFIG.WITHDRAW_PERCENTAGE} Çekim Başarılı`.green);
    console.log(`💸 Miktar: ${amount} WMON`.magenta);
    return tx.wait();
  } catch (error) {
    console.error(`❌ Withdraw Hatası: ${error.message}`.red);
    return null;
  }
}

// ########################################
// ##      ANA İŞLEM DÖNGÜSÜ         ##
// ########################################
async function processWallet(wallet, walletIndex) {
  try {
    console.log(`\n🔷 [Cüzdan ${walletIndex + 1}] İşlemler Başlıyor`.cyan.bold);
    
    // Bakiye Kontrolleri
    const [ethBalance, wmonBalance] = await Promise.all([
      provider.getBalance(new ethers.Wallet(wallet.privateKey, provider).address),
      checkWMONBalance(wallet, walletIndex)
    ]);
    
    // WMON Yükleme
    if (parseFloat(wmonBalance) === 0 && parseFloat(ethers.utils.formatEther(ethBalance)) > 0) {
      const wrapAmount = getRandomAmount();
      await wrapMON(wallet, wrapAmount, walletIndex);
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
    
    // Güncel WMON Bakiyesi
    const updatedWMON = await checkWMONBalance(wallet, walletIndex);
    
    if (parseFloat(updatedWMON) > 0) {
      // Full Deposit
      await depositToTarget(wallet, updatedWMON, walletIndex);
      
      // Rastgele bekleme
      await randomWait(walletIndex);
      
      // %80 Withdraw
      const withdrawAmount = (parseFloat(updatedWMON) * CONFIG.WITHDRAW_PERCENTAGE / 100).toFixed(6);
      await withdrawFromTarget(wallet, withdrawAmount, walletIndex);
    }
    
    console.log(`✅ [Cüzdan ${walletIndex + 1}] Tüm İşlemler Tamamlandı\n`.green.bold);
  } catch (error) {
    console.error(`❌ Kritik Hata: ${error.message}`.red.bold);
  }
}

// ########################################
// ##         BAŞLATMA FONKSİYONU     ##
// ########################################
async function main() {
  const WALLETS = getWalletsFromEnv();
  console.log(`\n🚀 Toplam ${WALLETS.length} Cüzdan İle İşlem Başlatılıyor...\n`.rainbow.bold);
  console.log(`🔄 Wrap Aralığı: ${CONFIG.MIN_WRAP}-${CONFIG.MAX_WRAP} MON`.yellow);
  console.log(`⏱️  Deposit-Withdraw Arası Bekleme: ${CONFIG.MIN_WAIT/1000}-${CONFIG.MAX_WAIT/1000} sn\n`.yellow);

  for (let i = 0; i < WALLETS.length; i++) {
    await processWallet(WALLETS[i], i);
    if (i < WALLETS.length - 1) {
      console.log(`⏳ ${CONFIG.WAIT_TIME/1000}s Sonraki Cüzdana Geçiliyor...\n`.yellow);
      await new Promise(resolve => setTimeout(resolve, CONFIG.WAIT_TIME));
    }
  }
  
  console.log("\n🎉 Tüm İşlemler Başarıyla Tamamlandı!".rainbow.bold);
}

// ########################################
// ##          ÇALIŞTIRMA             ##
// ########################################
main().catch(error => {
  console.error(`🔴 Global Hata: ${error.message}`.red.bold);
  process.exit(1);
});
