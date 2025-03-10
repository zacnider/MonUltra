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
  { name: "Bebop", path: "./modul/bebop.js", description: "Bebop DEX işlemleri" },
  { name: "İzumi", path: "./modul/izumi.js", description: "İzumi Finance işlemleri" },
  { name: "Kitsu", path: "./modul/kitsu.js", description: "Kitsu protokolü etkileşimleri" },
  { name: "Magma", path: "./modul/magma.js", description: "Magma DEX işlemleri" },
  { name: "Monorail", path: "./modul/mono.js", description: "Monorail platformu etkileşimleri" },
  { name: "Apriori", path: "./modul/apriori.js", description: "Apriori protokolü işlemleri" },
  { name: "Taya", path: "./modul/taya.js", description: "Taya Swap işlemleri" },
  { name: "Deploy", path: "./modul/deploy.js", description: "Akıllı kontrat deployment işlemleri" },

];

// Güzel başlık
console.log(colors.rainbow(figlet.textSync('Multi-Wallet Bot', {
  font: 'Standard',
  horizontalLayout: 'default',
  verticalLayout: 'default'
})));

console.log("\n" + "🔥 MODÜL LİSTESİ 🔥".brightYellow.bold);
console.log("═".repeat(50).cyan);

// Modülleri güzel bir şekilde listele
scripts.forEach((script, index) => {
  console.log(`${(index + 1).toString().padStart(2)} ${colors.green('➤')} ${script.name.padEnd(10).brightBlue} ${colors.gray('|')} ${script.description.gray}`);
});

console.log("═".repeat(50).cyan);
console.log(`${"ℹ️  Birden fazla seçim için virgülle ayırın (örn: 1,3,5)".italic.gray}`);
console.log(`${"ℹ️  Tümünü seçmek için 'all' yazın".italic.gray}\n`);

// Kullanıcı seçimi için prompt
async function selectScripts() {
  const response = await prompts({
    type: 'text',
    name: 'selection',
    message: 'Çalıştırmak istediğiniz modülleri seçin:',
    validate: value => {
      if (value.toLowerCase() === 'all') return true;
      
      const selections = value.split(',').map(s => s.trim());
      const valid = selections.every(s => {
        const num = parseInt(s);
        return !isNaN(num) && num > 0 && num <= scripts.length;
      });
      
      return valid || 'Lütfen geçerli modül numaraları girin veya "all" yazın';
    }
  });

  // Seçilen scriptleri belirle
  let selectedScripts = [];
  if (response.selection.toLowerCase() === 'all') {
    selectedScripts = [...scripts];
  } else {
    const selections = response.selection.split(',').map(s => parseInt(s.trim()) - 1);
    selectedScripts = selections.map(index => scripts[index]);
  }

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

// Seçilen scriptleri sırayla çalıştır
async function runScripts(selectedScripts) {
  console.log("\n" + "⚡ İŞLEMLER BAŞLATILIYOR ⚡".brightMagenta.bold);
  console.log("═".repeat(50).cyan + "\n");

  for (const script of selectedScripts) {
    await runScript(script);
  }

  console.log("\n" + "✅ TÜM İŞLEMLER TAMAMLANDI".brightGreen.bold);
  console.log("═".repeat(50).cyan);
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
