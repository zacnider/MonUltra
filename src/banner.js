require("colors"); // Sihirli renk büyüsünü yüklüyoruz! 🌈

function displayHeader() {
  // 🧹 ABRAKADABRA! Terminal ekranını süpürüyoruz!
  process.stdout.write("\x1Bc");

  // 🎭 Işıltılı sahne perdesini açıyoruz...
  console.log(`
            ${"★彡 SÜPER MEGA ULTRA BOT HAZIRLANIYOR 彡★".rainbow}
            ${"✧ CÜZDANLAR ŞARKILAR SÖYLÜYOR ✧".cyan}
            ${"☆ KODLAR DANS EDİYOR ☆".green}
  `.split("\n").map(line => line.padStart(60)).join("\n"));
  
  // 🥁 Davul sesleri...
  console.log("\n" + "🚀 BOT AÇILIYOR 🚀".america.bold);
  
  // 🎵 Açılış müziği çalıyor (hayal edin)
  console.log("┏" + "━".repeat(50) + "┓".cyan);
  console.log("┃" + " CÜZDAN ORDUSU GÖREVE HAZIR! ".padStart(35).yellow.bold + "     ┃".cyan);
  console.log("┗" + "━".repeat(50) + "┛".cyan);
  
  // 🎆 Havai fişek gösterisi!
  const fireworks = ["✨", "🎇", "🎆", "💫", "⭐"];
  let fireworkDisplay = "";
  
  for (let i = 0; i < 10; i++) {
    fireworkDisplay += fireworks[Math.floor(Math.random() * fireworks.length)] + " ";
  }
  
  console.log(fireworkDisplay.rainbow);
}

// 🧙‍♂️ Sihirli fonksiyonumuzu dışa aktarıyoruz!
module.exports = displayHeader;

// 🎮 Bu fonksiyon sadece bir başlık göstermiyor...
// 🎪 Terminal ekranında tam bir sirk gösterisi sunuyor!
// 🎯 Amacı: Kullanıcıyı eğlendirmek ve "Vay canına, bu uygulama harika!" dedirtmek!
// 🎁 Bonus: Sıkıcı kod yazma seanslarında gizli bir moral kaynağı!
