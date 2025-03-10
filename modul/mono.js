const { ethers } = require("ethers");
const colors = require("colors");
const cfonts = require("cfonts");
const displayHeader = require("../src/banner.js");

require("dotenv").config();
displayHeader();

// Monorail için gerekli adresler ve URL'ler
const RPC_URL = "https://testnet-rpc.monad.xyz";
const EXPLORER_URL = "https://testnet.monadexplorer.com/tx/";
const CONTRACT_ADDRESS = "0xC995498c22a012353FAE7eCC701810D673E25794"; // Monorail contract
const CHOG_ADDRESS = "0xE0590015A873bF326bd645c3E1266d4db41C4E6B"; // CHOG token
const ROUTER_ADDRESS = "0xfb8e1c3b833f9e67a71c859a132cf783b645e436"; // Monad DEX Router

// Çoklu cüzdan için private key'leri .env dosyasından oku
const privateKeys = [];
let i = 1;
while (true) {
  const key = process.env[`PRIVATE_KEY_${i}`];
  if (!key) break;
  privateKeys.push(key);
  i++;
}

// Eğer PRIVATE_KEY_1, PRIVATE_KEY_2 vs bulunamazsa, PRIVATE_KEY'i kontrol et
if (privateKeys.length === 0) {
  const singleKey = process.env.PRIVATE_KEY;
  if (singleKey) {
    privateKeys.push(singleKey);
  } else {
    console.error(colors.red("❌ Private key bulunamadı! .env dosyasında PRIVATE_KEY_1, PRIVATE_KEY_2, vb. veya en azından PRIVATE_KEY tanımlayın."));
    process.exit(1);
  }
}

console.log(`🔐 Loaded ${privateKeys.length} wallet(s) from .env file`.cyan);

// RPC Provider'a bağlan
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

console.log(`🪫  Starting Monorail ⏩⏩⏩⏩`.blue);
console.log(` `);

// ERC20 Token ABI
const erc20Abi = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

// Router ABI
const routerAbi = [
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)"
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkBalance(wallet) {
  const balance = await provider.getBalance(wallet.address);
  console.log(colors.cyan(`💰 MON Balance: ${ethers.utils.formatEther(balance)} MON`));
  return balance;
}

async function checkTokenBalance(wallet, tokenAddress) {
  try {
    tokenAddress = ethers.utils.getAddress(tokenAddress);
    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, wallet);
    const balance = await tokenContract.balanceOf(wallet.address);
    const decimals = await tokenContract.decimals();
    const symbol = await tokenContract.symbol();
    
    const formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log(colors.cyan(`💰 ${symbol} Balance: ${formattedBalance} ${symbol}`));
    
    return { balance, decimals, symbol };
  } catch (error) {
    console.error(colors.red(`❌ Token bakiyesi kontrol edilirken hata: ${error.message}`));
    return { balance: ethers.BigNumber.from(0), decimals: 18, symbol: "UNKNOWN" };
  }
}

// Monorail token alma işlemi
async function buyTokens(wallet) {
  console.log(colors.green(`👛 Working with wallet: ${wallet.address}`));
  
  const balance = await checkBalance(wallet);

  if (balance.lt(ethers.utils.parseEther("0.1"))) {
    console.error(colors.red(`❌ Yetersiz bakiye. En az 0.1 MON gerekli.`));
    return { success: false, tokenBalance: ethers.BigNumber.from(0) };
  }

  const walletData = { account: { address: wallet.address } };
  
  // Monorail için özel calldata - CHOG token alma
  const data = `0x96f25cbe0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000e0590015a873bf326bd645c3e1266d4db41c4e6b000000000000000000000000000000000000000000000000016345785d8a0000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000001a0000000000000000000000000${walletData.account.address.replace(/^0x/, "")}000000000000000000000000000000000000000000000000542f8f7c3d64ce470000000000000000000000000000000000000000000000000000002885eeed340000000000000000000000000000000000000000000000000000000000000004000000000000000000000000760afe86e5de5fa0ee542fc7b7b713e1c5425701000000000000000000000000760afe86e5de5fa0ee542fc7b7b713e1c5425701000000000000000000000000cba6b9a951749b8735c603e7ffc5151849248772000000000000000000000000760afe86e5de5fa0ee542fc7b7b713e1c54257010000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000c0000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000002800000000000000000000000000000000000000000000000000000000000000004d0e30db0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044095ea7b3000000000000000000000000cba6b9a951749b8735c603e7ffc5151849248772000000000000000000000000000000000000000000000000016345785d8a000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000010438ed1739000000000000000000000000000000000000000000000000016345785d8a0000000000000000000000000000000000000000000000000000542f8f7c3d64ce4700000000000000000000000000000000000000000000000000000000000000a0000000000000000000000000c995498c22a012353fae7ecc701810d673e257940000000000000000000000000000000000000000000000000000002885eeed340000000000000000000000000000000000000000000000000000000000000002000000000000000000000000760afe86e5de5fa0ee542fc7b7b713e1c5425701000000000000000000000000e0590015a873bf326bd645c3e1266d4db41c4e6b000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000044095ea7b3000000000000000000000000cba6b9a951749b8735c603e7ffc5151849248772000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000`;

  const value = ethers.utils.parseEther("0.1");

  try {
    console.log(colors.yellow("🔍 Token alma işlemi kontrol ediliyor..."));
    await provider.call({ to: CONTRACT_ADDRESS, data: data });
    console.log(colors.green("✅ İşlem geçerli. Devam ediliyor..."));

    let gasLimit;
    try {
      gasLimit = await provider.estimateGas({
        from: wallet.address,
        to: CONTRACT_ADDRESS,
        value: value,
        data: data,
      });
      // Gas limitine %20 marj ekle
      gasLimit = gasLimit.mul(120).div(100);
    } catch (err) {
      console.warn(colors.yellow("⚠️ Gas tahmini başarısız. Varsayılan gas limit kullanılıyor."));
      gasLimit = ethers.utils.hexlify(200000);
    }

    // Güncel nonce değerini al
    const nonce = await provider.getTransactionCount(wallet.address, "latest");
    console.log(colors.blue(`📊 Nonce: ${nonce}`));

    const tx = {
      from: wallet.address,
      to: CONTRACT_ADDRESS,
      data: data,
      value: value,
      gasLimit: gasLimit,
      gasPrice: await provider.getGasPrice(),
      nonce: nonce
    };

    console.log(colors.blue("🚀 Token alma işlemi gönderiliyor..."));
    const txResponse = await wallet.sendTransaction(tx);
    console.log(colors.green(`✅ İşlem gönderildi! Onay bekleniyor...`));
    console.log(colors.yellow(`📌 Hash: ${txResponse.hash}`));
    
    // İşlem onayını bekle
    const receipt = await txResponse.wait();
    
    console.log(colors.green(`🎉 Token alma işlemi başarılı! Blok: ${receipt.blockNumber}`));
    console.log(colors.cyan(`🔗 Explorer: ${EXPLORER_URL}${txResponse.hash}`));
    
    // İşlem sonrası token bakiyesini kontrol et
    const tokenInfo = await checkTokenBalance(wallet, CHOG_ADDRESS);
    
    return { success: true, tokenBalance: tokenInfo.balance };
  } catch (error) {
    console.error(colors.red("❌ Token alma hatası:", error.message || error));
    return { success: false, tokenBalance: ethers.BigNumber.from(0) };
  }
}

// Uniswap benzeri router kullanarak token satış işlemi
async function sellTokensWithRouter(wallet, tokenBalance) {
  try {
    console.log(colors.green(`\n🔄 Token satış işlemi başlatılıyor (Router ile)...`));
    
    // Token bakiyesi kontrol et
    if (!tokenBalance || tokenBalance.lte(0)) {
      const tokenInfo = await checkTokenBalance(wallet, CHOG_ADDRESS);
      tokenBalance = tokenInfo.balance;
      
      if (tokenBalance.lte(0)) {
        console.log(colors.yellow(`⚠️ CHOG bakiyesi sıfır, satış yapılamıyor.`));
        return false;
      }
    }
    
    // Token kontratını oluştur
    const tokenContract = new ethers.Contract(CHOG_ADDRESS, erc20Abi, wallet);
    
    // Router kontratını oluştur
    const router = new ethers.Contract(ROUTER_ADDRESS, routerAbi, wallet);
    
    console.log(colors.blue(`🔓 Router için token harcama yetkisi veriliyor...`));
    
    // Approve işlemi için nonce al
    const approveNonce = await provider.getTransactionCount(wallet.address, "latest");
    console.log(colors.blue(`📊 Approve Nonce: ${approveNonce}`));
    
    // Satılacak token miktarı (tüm bakiye)
    const amountToSell = tokenBalance;
    console.log(colors.blue(`💰 Satılacak miktar: ${ethers.utils.formatUnits(amountToSell, 18)} CHOG`));
    
    // Router'a token harcama yetkisi ver
    const approveTx = await tokenContract.approve(
      ROUTER_ADDRESS,
      amountToSell,
      {
        gasLimit: 200000,
        nonce: approveNonce
      }
    );
    
    console.log(colors.yellow(`📌 Onay Hash: ${approveTx.hash}`));
    await approveTx.wait();
    console.log(colors.green(`✅ Onay işlemi tamamlandı!`));
    
    // Swap yolu: CHOG -> WMON (Wrapped MON)
    const path = [
      CHOG_ADDRESS,
      "0x760AfE86e5de5fa0Ee542fc7B7B713e1c5425701" // WMON adresi
    ];
    
    // Tahmini çıktı değeri
    try {
      const amountsOut = await router.getAmountsOut(amountToSell, path);
      console.log(colors.blue(`💱 Tahmini alınacak MON: ${ethers.utils.formatEther(amountsOut)}`));
    } catch (error) {
      console.warn(colors.yellow(`⚠️ Tahmini değer hesaplanamadı: ${error.message}`));
    }
    
    // Swap işlemi için nonce al
    const swapNonce = await provider.getTransactionCount(wallet.address, "latest");
    console.log(colors.blue(`📊 Swap Nonce: ${swapNonce}`));
    
    // İşlem son geçerlilik süresi (10 dakika)
    const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
    
    console.log(colors.blue(`🔄 Token'lar MON'a çevriliyor...`));
    
    // swapExactTokensForETH işlemi
    const swapTx = await router.swapExactTokensForETH(
      amountToSell,          // Satılacak token miktarı
      0,                     // Minimum alınacak MON (slippage koruması kapalı)
      path,                  // Swap yolu
      wallet.address,        // MON'ların gönderileceği adres
      deadline,              // İşlem son geçerlilik süresi
      {
        gasLimit: 250000,
        nonce: swapNonce
      }
    );
    
    console.log(colors.yellow(`📌 Swap Hash: ${swapTx.hash}`));
    await swapTx.wait();
    console.log(colors.green(`✅ Token satış işlemi tamamlandı!`));
    
    // İşlem sonrası bakiyeleri göster
    await checkBalance(wallet);
    await checkTokenBalance(wallet, CHOG_ADDRESS);
    
    return true;
  } catch (error) {
    console.error(colors.red(`❌ Token satış hatası: ${error.message}`));
    
    // Hata detaylarını göster
    if (error.error) {
      console.error(colors.red(`Detaylı hata: ${JSON.stringify(error.error)}`));
    }
    
    return false;
  }
}

// Tüm cüzdanları işle
async function processAllWallets() {
  console.log(colors.cyan(`🌐 Toplam ${privateKeys.length} cüzdan işlenecek`));
  console.log(colors.cyan(`🌐 RPC: ${RPC_URL}`));
  console.log(colors.cyan(`📝 Contract: ${CONTRACT_ADDRESS}`));
  console.log(colors.cyan(`🔄 Router: ${ROUTER_ADDRESS}`));
  console.log(" ");
  
  for (let i = 0; i < privateKeys.length; i++) {
    console.log(colors.yellow(`\n👛 Cüzdan ${i + 1}/${privateKeys.length} işleniyor...`));
    
    // Cüzdanı oluştur
    const wallet = new ethers.Wallet(privateKeys[i], provider);
    
    // 1. İlk olarak token alım işlemini gerçekleştir
    const { success, tokenBalance } = await buyTokens(wallet);
    
    if (success) {
      // İşlem sonrası biraz bekle
      const waitAfterBuy = Math.floor(Math.random() * (15000 - 10000 + 1)) + 10000;
      console.log(colors.blue(`⏳ Satış işlemi öncesi ${waitAfterBuy/1000} saniye bekleniyor...`));
      await sleep(waitAfterBuy);
      
      // 2. Alınan tokenları router üzerinden sat
      await sellTokensWithRouter(wallet, tokenBalance);
    }
    
    // Cüzdanlar arası bekleme süresi
    if (i < privateKeys.length - 1) {
      const walletDelay = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000;
      console.log(colors.blue(`\n⏳ Sonraki cüzdan için ${walletDelay/1000} saniye bekleniyor...`));
      await sleep(walletDelay);
    }
  }
  
  console.log(colors.green(`\n✅ Tüm cüzdan işlemleri tamamlandı!`));
}

// Ana işlemi başlat
processAllWallets().catch(err => {
  console.error(colors.red("\n❌ FATAL ERROR:"), err);
  process.exit(1);
});
