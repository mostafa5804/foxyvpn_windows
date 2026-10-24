<div align="center">
  <img src="public/foxyvpn-windows-logo.svg" width="128" height="128" alt="FoxyVPN Windows Logo" />
  <h1>FoxyVPN for Windows (v1.0.6)</h1>
  <p><strong>Native Windows Desktop Client for Mozilla Firefox IP Protection (Guardian / Fastly MASQUE & HTTP/2 CONNECT)</strong></p>

  <p>
    </a>
    <a href="https://github.com/mostafa5804/foxyvpn_windows/releases"><img src="https://img.shields.io/github/v/release/mostafa5804/foxyvpn_windows?color=f97316&label=Release" alt="Latest Release" /></a>
    <img src="https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011%20(x64)-0078D6?logo=windows" alt="Platform Windows" />
    <img src="https://img.shields.io/badge/Go-1.23+-00ADD8?logo=go" alt="Go 1.23+" />
    <img src="https://img.shields.io/badge/Wintun-Layer--3%20TUN-10b981" alt="Wintun Layer 3" />
  </p>

  <p>
    <a href="#-نسخه-فارسی-persian">🇮🇷 توضیحات فارسی</a> •
    <a href="#-english-documentation">🇬🇧 English Documentation</a> •
    <a href="#-downloads--packages">📦 Downloads</a> •
    <a href="#-building-from-source">🛠️ Build from Source</a>
  </p>
</div>

---

## 🇮🇷 نسخه فارسی (Persian)

### درباره برنامه
**FoxyVPN برای ویندوز** یک کلاینت دسکتاپ بومی، متن‌باز و فوق‌سریع برای سیستم‌عامل ویندوز ۱۰ و ۱۱ است که زیرساخت شبکه خصوصی **Mozilla Firefox IP Protection (سرویس Guardian مبتنی بر شبکه لبه Fastly)** را بدون نیاز به مرورگر فایرفاکس، به یک تونل کامل سیستمی در ویندوز تبدیل می‌کند.

این برنامه با ترکیب هسته شبکه **Go**، درایور کرنل **Wintun (لایه ۳)** و رابط کاربری مدرن، ترافیک کل سیستم‌عامل یا برنامه‌های انتخابی شما را از طریق پروتکل‌های استاندارد و مقاوم **HTTP/2 CONNECT** و **MASQUE (HTTP/3 QUIC)** عبور می‌دهد.

---

### ✨ امکانات و ویژگی‌های کلیدی

#### ۱. استخر چندحسابی نامحدود (Multi-Account Pool)
- **۵۰ گیگابایت ترافیک رایگان به ازای هر اکانت:** هر حساب رایگان Mozilla (Firefox Account) ماهانه ۵۰ گیگابایت ترافیک اختصاصی روی سرورهای پرسرعت Fastly ارائه می‌دهد.
- **افزودن بی‌نهایت اکانت:** امکان ورود و ذخیره همزمان چندین حساب کاربری موزیلا در استخر اکانت‌ها.
- **سوئیچ خودکار هوشمند (Auto-Failover):** در صورت اتمام حجم یک اکانت یا بروز محدودیت، برنامه بدون قطع شدن تونل VPN به‌طور خودکار به اکانت سالم بعدی متصل می‌شود.
- **پشتیبان‌گیری و بازیابی (JSON):** امکان خروجی گرفتن از تمام اکانت‌ها و توکن‌های احراز هویت و بازیابی سریع آن‌ها روی سیستم‌های دیگر.

#### ۲. شبکه سرورهای جهانی Fastly (۳۸ سرور در ۲۲ کشور)
- **دریافت زنده از Mozilla Remote Settings:** لیست سرورهای لبه Fastly مستقیماً از API رسمی موزیلا (`vpn-serverlist`) دریافت و به‌روزرسانی می‌شود.
- **پوشش کامل ۳۸ موقعیت در ۲۲ کشور:** شامل آمریکا (۱۱ شهر)، آلمان، انگلستان، هلند، فرانسه، سوئیس، سوئد، فنلاند، اتریش، اسپانیا، ایتالیا، لهستان، بلژیک، جمهوری چک، رومانی، بلغارستان، صربستان، اوکراین، کانادا، ژاپن، سنگاپور و استرالیا.
- **انتخاب هوشمند سریع‌ترین سرور (Auto Best Ping):** تست پینگ موازی (TCP/TLS Handshake) از تمامی سرورها و اتصال خودکار به کم‌تاخیرترین نود در دسترس.

#### ۳. حالت‌های اتصال و تفکیک ترافیک (TUN & Split Tunneling)
- **حالت Wintun (تونل کامل لایه ۳ - System-wide VPN):** ایجاد کارت شبکه مجازی کرنل (`FoxyVPN Tunnel`) با مسیریابی کامل ترافیک ویندوز (`0.0.0.0/1` و `128.0.0.0/1`) و پشتیبانی از بازی‌ها و نرم‌افزارهای دسکتاپ.
- **حالت پروکسی سیستمی (System Proxy Mode):** اجرای سرور محلی **SOCKS5** (پورت پیش‌فرض `10808`) و **HTTP Proxy** (پورت پیش‌فرض `10809`) به همراه تنظیم و بازیابی خودکار رجیستری WinINET ویندوز بدون نیاز به دسترسی Administrator.
- **تونل تفکیکی برنامه‌ها (Per-App Split Tunneling):**
  - **گذر همه برنامه‌ها (All Apps):** عبور تمام ترافیک سیستم از تونل VPN.
  - **استثنا کردن برنامه‌ها (Bypass Selected):** عبور مستقیم برنامه‌های انتخاب‌شده از اینترنت بدون فیلترشکن.
  - **فقط برنامه‌های انتخابی (Only Selected):** عبور دادن صرفاً برنامه‌های مشخص‌شده (مانند تلگرام، دیسکورد، مرورگر یا بازی‌ها) از تونل VPN.
- **اشتراک‌گذاری در شبکه محلی (Allow LAN Sharing):** امکان استفاده سایر دستگاه‌های متصل به وای‌فای/شبکه محلی (موبایل، کنسول بازی، تلویزیون) از پروکسی FoxyVPN با گوش دادن روی `0.0.0.0`.

#### ۴. تنظیمات پیشرفته تونل و ضد فیلترینگ (Anti-DPI)
- **انتخاب پروتکل انتقال (Transport Protocol):**
  - `Auto (HTTP/2 + MASQUE Fallback)`: انتخاب هوشمند بین HTTP/2 و HTTP/3.
  - `HTTP/2 CONNECT (TCP + TLS 1.3)`: سازگاری حداکثری با شبکه‌های محدودشده.
  - `MASQUE (HTTP/3 QUIC UDP)`: سرعت بالا و تاخیر بسیار پایین مبتنی بر QUIC.
- **تکه‌تکه کردن بسته‌های TLS (Packet Fragmentation):** قابلیت شکستن رکوردهای TLS ClientHello (تنظیم اندازه قطعه `Fragment Size` و وقفه ارسال `Fragment Delay`) برای عبور از سیستم‌های بازرسی عمیق بسته (DPI).
- **DNS امن (DNS-over-HTTPS):** پشتیبانی از Cloudflare (`1.1.1.1`), Google (`8.8.8.8`), Quad9 (`9.9.9.9`) و AdGuard (`94.140.14.14`) برای جلوگیری از مسمومیت و نشت DNS.
- **کیل‌سوئیچ سخت‌افزاری (Kill Switch):** مسدودسازی خودکار ترافیک مستقیم از طریق فایروال ویندوز در صورت افت ناگهانی تونل برای جلوگیری از لو رفتن IP واقعی.
- **مسدودسازی نشت IPv6 (IPv6 Leak Protection):** جلوگیری از نشت ترافیک روی شبکه IPv6 در زمان اتصال.
- **تنظیم MTU سفارشی:** امکان بهینه‌سازی سایز بسته‌های شبکه (`1280` تا `1500` بایت) برای اینترنت‌های همراه و ثابت.

#### ۵. امنیت داده و ذخیره‌سازی باینری رمزنگاری‌شده
- **ذخیره‌سازی امن در `data/account.bin`:** هیچ توکن یا اطلاعات حسابی در فایل‌های متنی ساده (Plaintext) یا `localStorage` ذخیره نمی‌شود.
- **رمزنگاری دو مرحله‌ای (Windows DPAPI + AES-256-GCM):** اطلاعات حساب‌ها و مصرف ترافیک با کلیدهای مشتق‌شده از شناسه ماشین و CryptProtectData ویندوز رمزنگاری می‌شوند.
- **بررسی آنلاین نسخه جدید:** امکان بررسی آخرین نسخه منتشرشده مستقیماً از مخزن رسمی گیت‌هاب در بخش «درباره برنامه».

---

## 🇬🇧 English Documentation

### About FoxyVPN for Windows
**FoxyVPN for Windows** is a high-performance, native Windows 10/11 desktop VPN client powered by **Go**, **Wails v2**, and **Wintun**. It unlocks **Mozilla Firefox IP Protection (Guardian / Fastly Edge Network)** as a full system-wide Layer-3 VPN or local SOCKS5/HTTP proxy—without requiring the Firefox browser.

---

### ✨ Core Features

#### 1. Unlimited Multi-Account Pool & Auto-Failover
- **50 GB Monthly Bandwidth per Account:** Every free Mozilla Account (`accounts.firefox.com`) provides 50 GB/month of high-speed Fastly Edge traffic.
- **Unlimited Account Stacking:** Sign in with as many Mozilla accounts as you want and manage them in a unified pool.
- **Zero-Downtime Auto-Switch:** Automatically rotates to the next healthy account in your pool when an account reaches its bandwidth cap or token limit.
- **One-Click JSON Backup & Restore:** Export and import your entire account pool across machines.

#### 2. 38 Fastly Edge Locations Across 22 Countries
- **Live Sync with Mozilla Remote Settings:** Fetches real-time Fastly edge endpoints from Mozilla's official `vpn-serverlist` records.
- **Global Coverage:** 38 server cities across 22 countries including the United States (11 cities), Germany, United Kingdom, Netherlands, France, Switzerland, Sweden, Finland, Austria, Spain, Italy, Poland, Belgium, Czechia, Romania, Bulgaria, Serbia, Ukraine, Canada, Japan, Singapore, and Australia.
- **Auto Best Latency Selection:** Concurrent TCP/TLS latency probing automatically selects the fastest edge node for your connection.

#### 3. Dual Tunnel Modes & Per-App Split Tunneling
- **Wintun Layer-3 Kernel Tunnel:** Creates a dedicated virtual network adapter (`FoxyVPN Tunnel`) with split default routes (`0.0.0.0/1` and `128.0.0.0/1`) to tunnel all system applications and games.
- **System Proxy Mode (SOCKS5 & HTTP):** Runs local SOCKS5 (`127.0.0.1:10808`) and HTTP (`127.0.0.1:10809`) listeners with automatic Windows WinINET registry state backup and restoration.
- **Per-App Split Tunneling:**
  - **All Apps:** Route all system traffic through the VPN.
  - **Bypass Selected Apps:** Exclude chosen `.exe` processes from the VPN tunnel.
  - **Tunnel Only Selected Apps:** Route only specified applications (e.g., Telegram, Discord, Chrome, Steam) through FoxyVPN.
- **LAN Proxy Sharing:** Optionally bind proxy listeners to `0.0.0.0` so mobile devices and consoles on the same Wi-Fi/LAN can share the tunnel.

#### 4. Advanced Tunnel & Anti-DPI Engine
- **Selectable Transport Protocols:** Choose between `Auto (HTTP/2 + MASQUE)`, `HTTP/2 CONNECT (TLS 1.3)`, or `MASQUE (HTTP/3 QUIC)`.
- **TLS Record & SNI Fragmentation:** Configurable `Fragment Size` (bytes) and `Fragment Delay` (ms) to bypass Deep Packet Inspection (DPI) firewalls.
- **Encrypted DNS (DoH):** Built-in DNS-over-HTTPS support for Cloudflare (`1.1.1.1`), Google (`8.8.8.8`), Quad9 (`9.9.9.9`), and AdGuard (`94.140.14.14`).
- **Windows Firewall Kill Switch:** Blocks non-tunnel outbound traffic if the VPN drops unexpectedly, restoring normal rules on intentional disconnect.
- **IPv6 Leak Protection & Custom MTU:** Prevents IPv6 traffic leaks and allows fine-tuning adapter MTU (`1280`–`1500`).

#### 5. Cryptographic Storage & Verifiable Security
- **Encrypted Binary Vault (`data/account.bin`):** Account tokens, OAuth credentials, and quota states are encrypted on disk using **Windows DPAPI (`CryptProtectData`) + AES-256-GCM**.
- **Pinned Wintun Binary Verification:** Automatically verifies the official `wintun.dll` v0.14.1 against its pinned SHA-256 hash (`07c256185d6ee3652e09fa55c0b673e2624b565e02c4b9091c79ca7d2f24ef51`).

---

## 📦 Downloads & Packages

Every release on [GitHub Releases](https://github.com/mostafa5804/foxyvpn_windows/releases) provides three ready-to-use Windows x64 packages:

| Package | File Name | Description |
| :--- | :--- | :--- |
| **🚀 Single-File Portable** | `FoxyVPN-Portable.exe` | Self-extracting standalone executable with `wintun.dll` embedded. No installation required. |
| **💿 Windows Installer** | `FoxyVPN-Setup.exe` | Full NSIS Windows installer with Start Menu & Desktop shortcuts and uninstaller. |
| **📁 Portable Archive** | `FoxyVPN-Windows-amd64.zip` | Standard zip archive containing `FoxyVPN.exe` and `wintun.dll`. |

> **Note:** **System Proxy Mode** works without elevation. **Wintun Layer-3 Mode** requires running FoxyVPN as **Administrator** to create and configure the virtual network adapter.

---

## 🛠️ Building from Source

### Prerequisites
- **Windows 10 / 11 (64-bit)**
- **Go 1.23+**
- **Node.js 20+** & npm
- **Wails CLI v2.9.2** (`go install github.com/wailsapp/wails/v2/cmd/wails@v2.9.2`)
- **WebView2 Runtime** (pre-installed on Windows 10/11)

### Build Steps
```powershell
# 1. Clone the repository
git clone https://github.com/mostafa5804/foxyvpn_windows.git
cd foxyvpn_windows

# 2. Install frontend dependencies
npm install

# 3. Download & verify official Wintun v0.14.1 (amd64)
Invoke-WebRequest -Uri "https://www.wintun.net/builds/wintun-0.14.1.zip" -OutFile "wintun.zip"
Expand-Archive -Path "wintun.zip" -DestinationPath "wintun_extracted" -Force
Copy-Item "wintun_extracted\wintun\bin\amd64\wintun.dll" -Destination "pkg\vpn\wintun.dll" -Force

# 4. Build the native Wails desktop application
wails build -platform windows/amd64 -clean -o FoxyVPN.exe
Copy-Item "pkg\vpn\wintun.dll" -Destination "build\bin\wintun.dll" -Force
```

---

## 📄 License
Released under the **MIT License**. Built for privacy, speed, and open internet access.
