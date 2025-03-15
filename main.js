const prompts = require("prompts");
const { spawn } = require("child_process");
const displayHeader = require("./src/banner.js");
const colors = require("colors");
const figlet = require('figlet');

// Banner göster
displayHeader();

// Modül listesi
const scripts = [
  { name: "Uniswap", path: "./modul/uniswap.js", description: "Uniswap üzerinde token swap işlemleri" },
  { name: "Rubic", path: "./modul/rubic.js", description: "Rubic swap işlemleri" },
  { name: "Bean", path: "./modul/bean.js", description: "Bean protokolü etkileşimleri" },
  { name: "İzumi", path: "./modul/izumi.js", description: "İzumi Finance işlemleri" },
  { name: "Kitsu", path: "./modul/kitsu.js", description: "Kitsu protokolü etkileşimleri" },
  { name: "Magma", path: "./modul/magma.js", description: "Magma DEX işlemleri" },
  { name: "Taya", path: "./modul/taya.js", description: "Taya Swap işlemleri" },
  { name: "Deploy", path: "./modul/deploy.js", description: "Akıllı kontrat deployment işlemleri" },
];

// Başlık
console.log(colors.rainbow(figlet.textSync('Multi-Wallet Bot', {
  font: 'Standard',
  horizontalLayout: 'default',
  verticalLayout: 'default'
})));

// Rastgele script seçme fonksiyonu
function getRandomScripts(count) {
  // Scripti karıştır ve belirtilen sayıda seç
  const shuffled = [...scripts].sort(() => 0.5 - Math.random());
  // Count sayısı, toplam script sayısından büyükse, tüm scriptleri döndür
  const scriptCount = Math.min(count, scripts.length);
  return shuffled.slice(0, scriptCount);
}

// Menüyü göster
function displayMenu() {
  console.log("\n" + "🔥 MODÜL LİSTESİ 🔥".brightYellow.bold);
  console.log("═".repeat(50).cyan);

  // Modülleri  listele
  scripts.forEach((script, index) => {
    console.log(`${(index + 1).toString().padStart(2)} ${colors.green('➤')} ${script.name.padEnd(10).brightBlue} ${colors.gray('|')} ${script.description.gray}`);
  });

  console.log("═".repeat(50).cyan);
  console.log(`${"ℹ️  Birden fazla seçim için virgülle ayırın (örn: 1,3,5)".italic.gray}`);
  console.log(`${"ℹ️  Tümünü seçmek için 'all' yazın".italic.gray}`);
  console.log(`${"ℹ️  Rastgele seçim için 'random' yazın".italic.gray}`);
  console.log(`${"ℹ️  Sonsuz rastgele döngü için 'loop' yazın ".italic.gray}\n`);
}

// Kullanıcı seçimi için prompt
async function selectScripts() {
  displayMenu();
  
  const response = await prompts({
    type: 'text',
    name: 'selection',
    message: 'Çalıştırmak istediğiniz modülleri seçin:',
    validate: value => {
      const input = value.toLowerCase().trim();
      
      // "all", "random", "loop" kontrolü
      if (input === 'all' || input === 'random' || input === 'loop') return true;
      
      // "random:N" kontrolü
      if (input.startsWith('random:')) {
        const parts = input.split(':');
        if (parts.length !== 2) return 'Geçerli bir format değil. Örnek: random:3';
        
        const count = parseInt(parts);
        if (isNaN(count) || count <= 0) return 'Geçerli bir sayı girin (örn: random:3)';
        return true;
      }
      
      // "loop:N" kontrolü
      if (input.startsWith('loop:')) {
        const parts = input.split(':');
        if (parts.length !== 2) return 'Geçerli bir format değil. Örnek: loop:3';
        
        const count = parseInt(parts);
        if (isNaN(count) || count <= 0) return 'Geçerli bir sayı girin (örn: loop:3)';
        return true;
      }
      
      // Normal seçim kontrolü
      const selections = input.split(',').map(s => s.trim());
      const valid = selections.every(s => {
        const num = parseInt(s);
        return !isNaN(num) && num > 0 && num <= scripts.length;
      });
      
      return valid || 'Lütfen geçerli modül numaraları girin, "all", "random" veya "loop" yazın';
    }
  });

  // Seçilen scriptleri belirle
  let selectedScripts = [];
  const input = response.selection.toLowerCase().trim();
  
  if (input === 'all') {
    selectedScripts = [...scripts];
    await runSelectedScripts(selectedScripts);
  } else if (input === 'random') {
    // Varsayılan olarak 1-3 arası rastgele sayıda script seç
    const randomCount = Math.floor(Math.random() * 3) + 1;
    selectedScripts = getRandomScripts(randomCount);
    console.log(`\n🎲 Rastgele ${randomCount} modül seçildi`.brightCyan);
    await runSelectedScripts(selectedScripts);
  } else if (input.startsWith('random:')) {
    // Belirtilen sayıda rastgele script seç
    const count = parseInt(input.split(':'));
    selectedScripts = getRandomScripts(count);
    console.log(`\n🎲 Rastgele ${count} modül seçildi`.brightCyan);
    await runSelectedScripts(selectedScripts);
  } else if (input === 'loop' || input.startsWith('loop:')) {
    // Sonsuz rastgele döngü
    let loopCount = 1; // Döngü sayacı
    let modulCount = 3; // Varsayılan modül sayısı
    
    if (input.startsWith('loop:')) {
      modulCount = parseInt(input.split(':'));
    }
    
    // Döngü seçenekleri
    const loopOptions = await prompts({
      type: 'select',
      name: 'loopType',
      message: 'Döngü çalışma şeklini seçin:',
      choices: [
        { title: 'Her döngüden sonra onay iste', value: 'confirm' },
        { title: 'Belirli bir süre bekleyerek otomatik devam et', value: 'timer' },
        { title: 'Durmadan sürekli çalış (Ctrl+C ile durdurabilirsiniz)', value: 'nonstop' }
      ],
      initial: 0
    });
    
    // Bekleme süresi (timer seçeneği için)
    let waitTime = 5;
    if (loopOptions.loopType === 'timer') {
      const timeResponse = await prompts({
        type: 'number',
        name: 'seconds',
        message: 'Her döngü arasında kaç saniye beklensin?',
        initial: 5,
        min: 1,
        max: 3600
      });
      waitTime = timeResponse.seconds;
    }
    
    // Sonsuz döngü başlat
    await runInfiniteLoop(modulCount, loopCount, loopOptions.loopType, waitTime);
  } else {
    // Normal seçimler
    const selections = input.split(',').map(s => parseInt(s.trim()) - 1);
    selectedScripts = selections.map(index => scripts[index]);
    await runSelectedScripts(selectedScripts);
  }
}

// Seçilen scriptleri çalıştırma fonksiyonu
async function runSelectedScripts(selectedScripts) {
  // Seçimleri göster
  console.log("\n" + "🚀 SEÇİLEN MODÜLLER:".brightGreen);
  selectedScripts.forEach((script, index) => {
    console.log(`${index + 1}. ${script.name.brightBlue}`);
  });

  // Onay al
  const confirmation = await prompts({
    type: 'confirm',
    name: 'value',
    message: 'Seçili modülleri çalıştırmak istiyor musunuz?',
    initial: true
  });

  if (confirmation.value) {
    await runScripts(selectedScripts);
  } else {
    console.log("İşlem iptal edildi.".yellow);
    process.exit(0);
  }
}

// Sonsuz rastgele döngü fonksiyonu
async function runInfiniteLoop(modulCount, loopCount, loopType, waitTime) {
  try {
    while (true) {
      // Rastgele modüller seç
      const selectedScripts = getRandomScripts(modulCount);
      
      console.log(`\n${"🔄 DÖNGÜ #".brightMagenta}${loopCount.toString().brightYellow} ${"BAŞLIYOR".brightMagenta}`);
      console.log(`${"🎲 Rastgele".cyan} ${modulCount} ${"modül seçildi:".cyan}`);
      
      selectedScripts.forEach((script, index) => {
        console.log(`${index + 1}. ${script.name.brightBlue}`);
      });
      
      // Modülleri çalıştır
      console.log("\n" + "⚡ İŞLEMLER BAŞLATILIYOR ⚡".brightMagenta.bold);
      console.log("═".repeat(50).cyan + "\n");
      
      for (const script of selectedScripts) {
        await runScript(script);
      }
      
      console.log("\n" + `✅ DÖNGÜ #${loopCount} TAMAMLANDI`.brightGreen.bold);
      console.log("═".repeat(50).cyan);
      
      loopCount++; // Döngü sayacını artır
      
      // Döngü tipine göre davran
      if (loopType === 'confirm') {
        // Kullanıcıdan onay iste
        const continueLoop = await prompts({
          type: 'confirm',
          name: 'value',
          message: 'Bir sonraki rastgele döngüye devam etmek istiyor musunuz?',
          initial: true
        });
        
        if (!continueLoop.value) {
          console.log("Sonsuz döngü sonlandırıldı.".yellow);
          break;
        }
      } else if (loopType === 'timer') {
        // Belirli bir süre bekle
        console.log(`\n⏳ Sonraki döngü için ${waitTime} saniye bekleniyor...`.cyan);
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }
      // nonstop seçeneğinde hiçbir şey yapmadan devam et
    }
  } catch (error) {
    console.error('Sonsuz döngüde hata oluştu:'.red, error);
  }
  
  // Döngü bittiğinde ana menüye dön
  await selectScripts();
}

// Seçilen scriptleri sırayla çalıştır
async function runScripts(selectedScripts) {
  console.log("\n" + "⚡ İŞLEMLER BAŞLATILIYOR ⚡".brightMagenta.bold);
  console.log("═".repeat(50).cyan + "\n");

  for (const script of selectedScripts) {
    await runScript(script);
  }

  console.log("\n" + "✅ TÜM İŞLEMLER TAMAMLANDI".brightGreen.bold);
  console.log("═".repeat(50).cyan);
  
  // Ana menüye dön
  await selectScripts();
}

// Script çalıştırma fonksiyonu
async function runScript(script) {
  console.log(`\n⏳ ${script.name} modülü başlatılıyor...`.yellow);

  return new Promise((resolve, reject) => {
    const process = spawn("node", [script.path]);
    let output = '';

    process.stdout.on("data", (data) => {
      const text = data.toString();
      output += text;
      console.log(text);
    });
    
    process.stderr.on("data", (data) => {
      console.error(`❌ HATA: ${data.toString()}`.red);
    });

    process.on("close", (code) => {
      if (code === 0) {
        console.log(`\n✅ ${script.name} başarıyla tamamlandı`.green);
      } else {
        console.log(`\n❌ ${script.name} başarısız oldu (Çıkış kodu: ${code})`.red);
      }
      resolve();
    });
  });
}

// Ana fonksiyon
async function main() {
  try {
    await selectScripts();
  } catch (error) {
    console.error('Bir hata oluştu:'.red, error);
  }
}

// Programı başlat
main();
