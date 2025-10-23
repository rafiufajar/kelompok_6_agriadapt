// ===== Utils =====
const $ = (sel) => document.querySelector(sel);
const el = (tag, opts = {}) => Object.assign(document.createElement(tag), opts);

// ===== Toast / Popup helper =====
function showToast(msg, type = "ok") {
  // type: ok | warn | danger
  const wrap = document.getElementById("toasts");
  if (!wrap) return;

  const div = document.createElement("div");
  div.className = `toast ${type}`;
  div.textContent = msg;

  // animasi masuk
  div.style.animation = "slideIn .25s ease-out";
  wrap.appendChild(div);

  // auto hilang + animasi keluar
  setTimeout(() => {
    div.style.animation = "fadeOut .25s ease-in forwards";
    setTimeout(() => div.remove(), 280);
  }, 2500);
}

// ===== Ikon Cuaca (Emoji) =====
const ICON_EMOJI = {
  "01d": "☀️",
  "01n": "🌙",
  "02d": "⛅",
  "02n": "☁️",
  "03d": "☁️",
  "03n": "☁️",
  "04d": "☁️",
  "04n": "☁️",
  "09d": "🌦️",
  "09n": "🌧️",
  "10d": "🌧️",
  "10n": "🌧️",
  "11d": "⛈️",
  "11n": "⛈️",
  "13d": "❄️",
  "13n": "❄️",
  "50d": "🌫️",
  "50n": "🌫️",
};
const iconToEmoji = (code) => ICON_EMOJI[code] || "⛅";

// Simpan cuaca terakhir → untuk kalkulasi IKM dinamis
let LAST_WEATHER = { temp: null, hum: null, wind: null };

// ===== Profil Komoditas & Lahan =====
const COMMODITY_PROFILES = {
  Padi: { temp: [24, 32], hum: [60, 90] },
  Jagung: { temp: [22, 34], hum: [50, 70] },
  Cabai: { temp: [20, 30], hum: [50, 70] },
  Tomat: { temp: [18, 28], hum: [55, 75] },
  Kangkung: { temp: [24, 32], hum: [60, 95] },
};

const LAHAN_FACTORS = {
  Sawah: { windPenalty: 1.0, humFlex: 0 },
  Tegalan: { windPenalty: 1.2, humFlex: 0 },
  Kebun: { windPenalty: 0.8, humFlex: 3 },
};

// ===== Kalkulasi IKM =====
function calcIKM({ temp, hum, wind, kom, lahan }) {
  const prof = COMMODITY_PROFILES[kom] || { temp: [24, 32], hum: [50, 85] };
  const adj = LAHAN_FACTORS[lahan] || { windPenalty: 1.0, humFlex: 0 };
  const [tLo, tHi] = prof.temp;
  const [hLo, hHi] = prof.hum;
  const humLo = hLo - adj.humFlex,
    humHi = hHi + adj.humFlex;

  const tOff = temp < tLo ? tLo - temp : temp > tHi ? temp - tHi : 0;
  const hOff = hum < humLo ? humLo - hum : hum > humHi ? hum - humHi : 0;

  const pTemp = tOff * 4;
  const pHum = hOff * 1.8;
  const pWind = (wind > 6 ? (wind - 6) * 5 : 0) * adj.windPenalty;

  let score = Math.round(100 - (pTemp + pHum + pWind));
  score = Math.max(0, Math.min(100, score));
  const label = score >= 80 ? "Sangat Baik" : score >= 70 ? "Baik" : score >= 60 ? "Cukup" : "Kurang";
  const klass = score >= 70 ? "ok" : score >= 60 ? "warn" : "danger";
  return { score, label, klass };
}

// ===== Update IKM dari pilihan user =====
function updateIKMFromSelections() {
  if (LAST_WEATHER.temp == null) return;
  const kom = $("#selectKomoditas")?.value || "Padi";
  const lahan = $("#selectLahan")?.value || "Sawah";
  const { score, label, klass } = calcIKM({
    temp: LAST_WEATHER.temp,
    hum: LAST_WEATHER.hum,
    wind: parseFloat(LAST_WEATHER.wind || 0),
    kom,
    lahan,
  });
  const badge = $("#ikmBadge");
  $("#ikmScore").textContent = `${score}/100`;
  badge.style.display = "inline-block";
  badge.textContent = label;
  badge.className = "badge " + klass;
}

// ===== Ambil Cuaca Realtime + Forecast =====
async function fakeFetchWeather() {
  const kota = ($("#inputKota").value || "").trim() || "Kendari";
  const key = window.OPENWEATHER_KEY;

  const urlNow = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
    kota
  )}&appid=${key}&units=metric&lang=id`;
  const urlFc = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(
    kota
  )}&appid=${key}&units=metric&lang=id`;

  try {
    // === CURRENT ===
    const rNow = await fetch(urlNow);
    if (!rNow.ok) throw new Error("Kota tidak ditemukan");
    const now = await rNow.json();

    const kondisi = now.weather?.[0]?.description || "—";
    const iconNow = now.weather?.[0]?.icon || "02d";
    const suhu = Math.round(now.main?.temp ?? 0);
    const hum = Math.round(now.main?.humidity ?? 0);
    const wind = (now.wind?.speed ?? 0).toFixed(1);
    const namaKota = now.name || kota;

    $("#statKota").textContent = namaKota;
    $("#statCuaca").textContent = kondisi;
    $("#statSuhu").textContent = `${suhu}°C`;
    $("#nowIcon").textContent = iconToEmoji(iconNow);
    $("#nowDesc").textContent = `${iconToEmoji(iconNow)}  ${kondisi} — ${namaKota}`;
    $("#nowTemp").textContent = `${suhu}°C`;
    $("#nowHum").textContent = `${hum}%`;
    $("#nowWind").textContent = `${wind} m/s`;
    $("#quickSummary").textContent = `${kondisi} • Suhu ${suhu}°C • Angin ${wind} m/s • RH ${hum}%`;
    $("#quickParams").textContent = `RH ${hum}% • Angin ${wind} m/s`;
    $("#quickAlert").textContent =
      /(hujan|petir|badai|angin)/i.test(kondisi) ? "⚠️ Waspada cuaca basah/angin." : "Tidak ada peringatan.";

    LAST_WEATHER = { temp: suhu, hum, wind };

    // ===== Popup otomatis untuk cuaca ekstrem =====
    const w = parseFloat(wind);
    const isRain = /(hujan|badai|petir|thunder)/i.test(kondisi);
    const tooHot = suhu >= 35;
    const tooCold = suhu <= 20;
    const veryHumid = hum >= 90;
    const veryWindy = w >= 8;

    if (isRain || tooHot || tooCold || veryHumid || veryWindy) {
      let msg = `Cuaca ${kondisi}. Suhu ${suhu}°C • RH ${hum}% • Angin ${wind} m/s.`;
      const type = isRain || veryWindy ? "danger" : "warn";
      showToast(msg, type);
    } else {
      showToast(`Cuaca kondusif di ${namaKota}: ${kondisi}, ${suhu}°C.`, "ok");
    }

    // === FORECAST ===
    const rFc = await fetch(urlFc);
    const tbody = $("#forecastRows");
    tbody.innerHTML = "";
    if (rFc.ok) {
      const fc = await rFc.json();
      const byDay = {};
      for (const item of fc.list) {
        const dt = new Date(item.dt * 1000),
          h = dt.getHours();
        const day = dt.toLocaleDateString("id-ID", { weekday: "short" });
        if (h >= 12 && h <= 15 && !byDay[day]) byDay[day] = item;
      }
      Object.keys(byDay)
        .slice(0, 5)
        .forEach((d) => {
          const it = byDay[d];
          const ic = it.weather?.[0]?.icon || "02d";
          const desc = it.weather?.[0]?.description || "";
          const tmin = Math.round(it.main?.temp_min ?? 0);
          const tmax = Math.round(it.main?.temp_max ?? 0);
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>${d}</td><td>${iconToEmoji(ic)} ${desc}</td><td>${tmin}–${tmax}°C</td>`;
          tbody.appendChild(tr);
        });
    } else {
      tbody.innerHTML = `<tr><td colspan="3">Forecast tidak tersedia.</td></tr>`;
    }

    updateIKMFromSelections();
  } catch (err) {
    console.error(err);
    $("#quickSummary").textContent = "Gagal memuat cuaca. Coba nama kota lain.";
    showToast("Gagal memuat cuaca. Periksa nama kota / koneksi.", "danger");
  }
}

// ===== Rekomendasi Tanam =====
function updateRekom() {
  const kom = $("#selectKomoditas").value;
  const lahan = $("#selectLahan").value;
  const musim = $("#selectMusim").value;
  
  $("#rekomTitle").textContent = `${kom} • ${lahan} • ${musim}`;
  
  const list = $("#rekomList");
  const tips = {
    Padi: {
      Kemarau: [
        "Pastikan irigasi tersedia sepanjang musim",
        "Gunakan varietas tahan kekeringan seperti Inpari 32",
        "Pemupukan N-P-K seimbang, hindari kelebihan nitrogen",
        "Awasi hama wereng coklat yang aktif saat kemarau"
      ],
      Hujan: [
        "Buat saluran drainase yang baik",
        "Gunakan varietas tahan rebah",
        "Kurangi dosis pemupukan nitrogen",
        "Waspada penyakit blast dan hawar daun"
      ]
    },
    Tomat: {
      Kemarau: [
        "Penyiraman teratur 2x sehari saat panas",
        "Gunakan mulsa untuk menjaga kelembapan tanah",
        "Berikan naungan parsial saat terik",
        "Tingkatkan pupuk kalium untuk kualitas buah"
      ],
      Hujan: [
        "Media tanam harus porous dengan drainase baik",
        "Gunakan plastik penutup untuk mengurangi hujan langsung",
        "Waspada penyakit busuk daun",
        "Kurangi frekuensi penyiraman"
      ]
    },
    Kangkung: {
      Kemarau: [
        "Jaga tanah selalu lembap dengan penyiraman rutin",
        "Tanam di lokasi yang agak teduh",
        "Panen lebih cepat (20-25 hari) sebelum terlalu keras",
        "Berikan pupuk organik cair seminggu sekali"
      ],
      Hujan: [
        "Ideal untuk kangkung air",
        "Pastikan tidak tergenang total",
        "Waspada siput dan keong",
        "Panen 25-30 hari setelah tanam"
      ]
    },
    Cabai: {
      Kemarau: [
        "Penyiraman teratur, hindari stress air saat berbunga",
        "Gunakan mulsa plastik hitam perak",
        "Berikan pupuk NPK dengan K tinggi saat generatif",
        "Awasi kutu daun dan trips"
      ],
      Hujan: [
        "Buat bedengan tinggi dengan drainase sempurna",
        "Gunakan atap plastik untuk mengurangi kelembapan",
        "Waspada antraknosa dan busuk buah",
        "Kurangi nitrogen, tingkatkan fosfor dan kalium"
      ]
    },
    Jagung: {
      Kemarau: [
        "Pilih varietas tahan kekeringan",
        "Tanam lebih rapat (60x20 cm)",
        "Berikan pupuk nitrogen cukup saat vegetatif",
        "Siram saat pembentukan tongkol"
      ],
      Hujan: [
        "Buat drainase yang baik di sela barisan",
        "Jarak tanam lebih lebar (75x25 cm)",
        "Kurangi dosis nitrogen",
        "Waspada penyakit bulai dan bercak daun"
      ]
    }
  };

  list.innerHTML = "";
  const rekomendasi = tips[kom]?.[musim] || [];
  rekomendasi.forEach((t) => {
    const li = el("li", { textContent: t });
    list.appendChild(li);
  });

  updateIKMFromSelections(); // sinkronkan IKM dg pilihan
}

// ===== Toggle Mobile Menu =====
function toggleMenu() {
  const menu = document.getElementById("mobileMenu");
  menu.style.display = menu.style.display === "flex" ? "none" : "flex";
}

// ===== Init =====
window.addEventListener("DOMContentLoaded", () => {
  // Tahun footer
  const yEl = $("#y");
  if (yEl) yEl.textContent = new Date().getFullYear();
  
  // Auto isi saat load
  updateRekom();
  fakeFetchWeather();
});

// Sinkronisasi IKM saat pilihan berubah
$("#selectKomoditas")?.addEventListener("change", updateIKMFromSelections);
$("#selectLahan")?.addEventListener("change", updateIKMFromSelections);

// --- Pastikan select selalu memicu update rekom + IKM ---
["selectKomoditas", "selectLahan", "selectMusim"].forEach((id) => {
  const s = document.getElementById(id);
  if (!s) return;
  ["change", "input"].forEach((ev) => {
    s.addEventListener(ev, () => {
      updateRekom(); // update teks rekomendasi
      updateIKMFromSelections(); // hitung ulang IKM
    });
  });
});
// ===== Login Admin =====
function showLoginModal() {
  document.getElementById("loginModal").style.display = "block";
  document.getElementById("loginError").style.display = "none";
  document.getElementById("adminUsername").value = "";
  document.getElementById("adminPassword").value = "";
}

function closeLoginModal() {
  document.getElementById("loginModal").style.display = "none";
}

function doLogin() {
  const username = document.getElementById("adminUsername").value.trim();
  const password = document.getElementById("adminPassword").value.trim();
  const errorEl = document.getElementById("loginError");

  // Kredensial admin (ganti sesuai kebutuhan)
  const ADMIN_USER = "admin";
  const ADMIN_PASS = "admin123";

  if (!username || !password) {
    errorEl.textContent = "Username dan password harus diisi!";
    errorEl.style.display = "block";
    return;
  }

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    showToast("Login berhasil! Selamat datang Admin.", "ok");
    closeLoginModal();
    
    // Simpan status login (opsional)
    localStorage.setItem("isAdminLoggedIn", "true");
    localStorage.setItem("adminUsername", username);
    
    // Redirect ke halaman admin atau tampilkan fitur admin
    setTimeout(() => {
      alert("Fitur admin bisa ditambahkan di sini!");
    }, 500);
  } else {
    errorEl.textContent = "Username atau password salah!";
    errorEl.style.display = "block";
    showToast("Login gagal. Periksa kredensial Anda.", "danger");
  }
}

// Tutup modal jika klik di luar modal
window.onclick = function(event) {
  const modal = document.getElementById("loginModal");
  if (event.target === modal) {
    closeLoginModal();
  }
}

// Enter key untuk login
document.addEventListener("DOMContentLoaded", function() {
  const passwordInput = document.getElementById("adminPassword");
  if (passwordInput) {
    passwordInput.addEventListener("keypress", function(e) {
      if (e.key === "Enter") {
        doLogin();
      }
    });
  }
});