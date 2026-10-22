<div align="center">

<img src="public/foxyvpn-windows-logo.svg" alt="FoxyVPN Windows Logo" width="130" height="130" />

# 🦊🪟 FoxyVPN Windows (v1.0.5)

**Native, Open-Source & Unlimited Multi-Account Desktop VPN for Windows 10 & 11**  
**کلاینت دسکتاپ بومی، پرتابل، متن‌باز و چنداکانته فایرفاکس VPN برای ویندوز ۱۰ و ۱۱**

[![Version](https://img.shields.io/badge/Version-1.0.5%20Stable-orange?style=for-the-badge&logo=github)](https://github.com/mostafa5804/foxyvpn_windows/releases)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011%20(x64)-0078D6?style=for-the-badge&logo=windows&logoColor=white)](#)
[![Built With](https://img.shields.io/badge/Built%20With-Wails%20v2%20%2B%20Go%201.23-00ADD8?style=for-the-badge&logo=go&logoColor=white)](#)
[![Monthly Quota](https://img.shields.io/badge/Traffic-50%20GB%20%2F%20Account%20(Unlimited%20Pool)-FE6C31?style=for-the-badge&logo=firefox-browser&logoColor=white)](#)
[![Driver](https://img.shields.io/badge/Network%20Driver-Wintun%20v0.14.1-10B981?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)

<br />

[English Documentation](#-english-documentation) • [Security & Verification](#-security-architecture--reproducible-builds) • [راهنمای فارسی](#-راهنمای-فارسی) • [Releases / دانلود نسخه جدید](https://github.com/mostafa5804/foxyvpn_windows/releases)

---

</div>

<br />

# 🇬🇧 English Documentation

## 🌟 Overview
**FoxyVPN Windows** is a high-performance, lightweight, open-source Windows desktop VPN client. It allows you to tunnel your entire operating system or browser traffic through **Mozilla Guardian's free 50 GB monthly allowance** over Fastly's globally distributed HTTP/2 CONNECT (MASQUE) edge topology.

### What's New in v1.0.5:
- **Encrypted Binary Account Store (`data/account.bin`):** Replaced legacy plaintext `.foxyvpn-tokens.json` with an encrypted binary store (`FOXYBIN1` + Windows DPAPI `CryptProtectData` + AES-256-GCM) saved automatically to `data/account.bin` (both Portable directory and `%LOCALAPPDATA%\FoxyVPN\data\account.bin`) so Portable and Setup updates never require signing in again.
- **Zero-Margin Full-Bleed Window:** Eliminated surrounding white borders and empty margins around the compact Windows client window (`400×760` native frame).
- **Wintun v0.14.1 SHA-256 Verification & Unstripped PE Symbols:** CI verifies the official WireGuard `wintun-0.14.1.zip` SHA-256 (`07c256185d6ee3652e09fa55c0b673e2624b565e02c4b9091c79ca7d2f24ef51`), removes `-s` symbol stripping to prevent Microsoft Defender ML false positives (`Trojan:Win32/Bearfoos.B!ml`), and publishes `SHA256SUMS.txt` on every release.
- **Clean English Footer Navigation:** Updated the English footer tab label from `Sign In / Account` to `Account`.
- **Real FxA Authentication for Account Pool:** Production Wails builds authenticate pool accounts via `window.go.main.App.AddAccountToPool` (PBKDF2-SHA256 + HKDF + Hawk) and securely destroy sessions (`POST /v1/session/destroy`) + zero-wipe `data/account.bin` on sign-out.

---

## ⚡ Multi-Account Token Pool (Unlimited Capacity)

### ❓ How many accounts can you add?
**Unlimited!** There is no hard limit on the number of accounts you can pool:
- **1 Account:** 50 GB / month
- **2 Accounts:** 100 GB / month
- **3 Accounts:** 150 GB / month
- **5 Accounts:** 250 GB / month
- **10 Accounts:** 500 GB / month

### 🛠️ How to Add Accounts (3 Flexible Methods):
1. **Easy & Automatic (Email & Password):**  
   You do **not** need to hunt for session tokens! Simply enter the email and password of your secondary or tertiary Firefox accounts. The app automatically derives PBKDF2-SHA256 (1000 rounds) + HKDF keys, logs in with Mozilla FxA, stores the session key, and combines the quotas.
2. **Manual Verification Mode (Token / Browser URL):**  
   If you click an activation link in an external browser (Firefox, Chrome, mobile), you bypass redirect failures. Simply copy and paste the session token, JWT (`ey...`), 6-digit code, or the full browser address bar into the app.
3. **Raw Token Import (Advanced):**  
   Batch paste 32- or 64-character hexadecimal session tokens (one per line) to instantly activate multiple accounts.

---

## 🚀 Key Features

| Feature | Description |
| :--- | :--- |
| **In-App Registration & Sign-In** | Create new accounts or log into existing Firefox accounts directly inside the app without browser redirect hassles. |
| **Dual Network Engines** | **1. Full System Wintun TUN:** Creates Layer-3 `FoxyVPN-Adapter` (`10.0.0.2/24`) routing all Windows traffic (`0.0.0.0/0`).<br>**2. WinINET System Proxy:** Runs a local SOCKS5 (`127.0.0.1:1080`) proxy and configures Windows Registry. |
| **Anti-DPI TLS SNI Split** | Fragments initial `TLS ClientHello` packets at the SNI boundary with `TCP_NODELAY` to bypass Deep Packet Inspection (DPI) censorship. |
| **Secure Encrypted DNS (DoH)** | Intercepts UDP/53 DNS queries and routes them through encrypted Cloudflare (`1.1.1.1`), Quad9 (`9.9.9.9`), or Google (`8.8.8.8`) servers. |
| **Kill Switch Protection** | Automatically cuts internet traffic if the tunnel drops unexpectedly to prevent real IP leaks. |
| **Diagnostics & Copy Logs** | Control-plane live terminal with one-click copy, clear, and refresh actions. |

---

## 🤝 Collaboration with the Android Developer
This Windows client was inspired by and ported from the popular Android project **[Vauth/FoxyVPN](https://github.com/vauth/foxyvpn)** and reference Go implementations.


---

## 📦 Download & Releases

Download the latest pre-compiled binaries from **[GitHub Releases](https://github.com/mostafa5804/foxyvpn_windows/releases)**:
- 📦 **`FoxyVPN-Portable.exe` (Recommended):** Standalone single executable with embedded `wintun.dll`. Zero installation required.
- 💿 **`FoxyVPN-Setup.exe`:** Standard NSIS Windows Installer with desktop & Start Menu shortcuts.
- 🗜️ **`FoxyVPN-Windows-amd64.zip`:** Portable archive containing binary and documentation.

## 🔒 Security Architecture & Reproducible Builds

1. **Encrypted Binary Credential Storage (`data/account.bin`):**
   - Plaintext `.foxyvpn-tokens.json` has been removed and replaced with `data/account.bin` (`pkg/auth/guardian.go` & `pkg/auth/dpapi_windows.go`).
   - Tokens are encrypted at rest using **AES-256-GCM** combined with **Windows DPAPI (`CryptProtectData` with `CRYPTPROTECT_UI_FORBIDDEN`)** bound to the current Windows user context and written with `0600` file permissions.
   - To support **seamless Portable & Setup updates without re-login**, `data/account.bin` is stored in `<exe_dir>/data/account.bin` (Portable) and mirrored in `%LOCALAPPDATA%\FoxyVPN\data\account.bin` (Setup Installer).
   - Signing out invokes Mozilla FxA `POST /v1/session/destroy` (Hawk HMAC-SHA256) to revoke the session server-side and overwrites `data/account.bin` with zeros before deletion.
2. **Wintun v0.14.1 Binary & Checksum Verification:**
   - `pkg/vpn/wintun.dll` in the Git source tree is intentionally a 45-byte text stub (`WINTUN_PLACEHOLDER_REPLACED_AT_CI_BUILD_TIME`) to avoid committing binary blobs to Git while satisfying Go's `//go:embed wintun.dll` directive.
   - During the GitHub Actions build (`.github/workflows/build-windows.yml`), the official WireGuard **Wintun v0.14.1** archive (`https://www.wintun.net/builds/wintun-0.14.1.zip`) is downloaded and cryptographically verified against its official SHA-256 checksum (`07C256185D6EE3652E09FA55C0B673E2624B565E02C4B9091C79CA7D2F24EF51`) before embedding `wintun/bin/amd64/wintun.dll` (digitally signed by *WireGuard LLC*).
3. **Windows Defender `Trojan:Win32/Bearfoos.B!ml` False-Positive Mitigation:**
   - Earlier builds compiled with `wails build -s` (`-ldflags="-s -w"` symbol stripping) and extracted `wintun.dll` on startup, which triggered Microsoft Defender's heuristic machine-learning detector (`Bearfoos.B!ml` — a generic ML heuristic common to unsigned, symbol-stripped Go network utilities).
   - In **v1.0.5**, symbol stripping (`-s`) is removed so standard Go PE symbol tables remain intact, `wintun.dll` is only loaded when the user explicitly starts a TUN session, and every GitHub Release includes `SHA256SUMS.txt` generated directly by the public GitHub Actions workflow.
4. **Network Endpoints Used by the Application:**
   - `https://api.accounts.firefox.com/v1/*` — Official Mozilla Firefox Accounts (FxA) authentication & OAuth token exchange.
   - `https://vpn.mozilla.org/api/v1/fpn/*` — Official Mozilla Guardian FPN entitlement status & short-lived ProxyPass JWT issuance.
   - `https://firefox.settings.services.mozilla.com/v1/buckets/main/collections/vpn-serverlist/records` — Official Mozilla Remote Settings server list.
   - `*.m1.fastly-masque.net:2499` — Official Fastly HTTP/2 CONNECT edge nodes.
   - `https://1.1.1.1/dns-query`, `https://9.9.9.9/dns-query`, `https://8.8.8.8/dns-query` — Encrypted DNS over HTTPS (DoH) resolvers.
   - `https://cloudflare.com/cdn-cgi/trace` — Exit IP verification through the active VPN tunnel.

---

<br />

# 🇮🇷 راهنمای فارسی

## 🌟 معرفی پروژه
**FoxyVPN Windows** یک کلاینت دسکتاپ بومی، سریع، پرتابل و متن‌باز برای ویندوز ۱۰ و ۱۱ است که به شما امکان می‌دهد از **سهمیه ۵۰ گیگابایت ماهانه رایگان موزیلا** (ارائه‌شده روی سرورهای Fastly با پروتکل HTTP/2 CONNECT و کارت شبکه مجازی Wintun) در **کل سیستم‌عامل ویندوز** استفاده کنید.

### امکانات جدید در نسخه ۱.۰.۵ (v1.0.5):
- **ذخیره خودکار اکانت در فایل باینری رمزنگاری‌شده (`data/account.bin`):** ذخیره‌سازی خودکار اکانت و استخر توکن‌ها در فایل باینری `data/account.bin` (رمزنگاری‌شده با Windows DPAPI + AES-256-GCM) در کنار فایل اجرایی و مسیر `%LOCALAPPDATA%\FoxyVPN\data\account.bin`؛ با این قابلیت، هنگام **آپدیت نسخه پرتابل یا نصبی نیازی به لاگین مجدد نیست**.
- **حذف کامل فضای خالی و حاشیه‌های سفید اطراف پنجره:** طراحی تمام‌صفحه بدون کادر یا حاشیه سفید اضافه در اطراف پنجره برنامه.
- **اصلاح متن فوتر انگلیسی:** تغییر عنوان تب اکانت در فوتر انگلیسی از `Sign In / Account` به `Account`.
- **بررسی رمزنگاری SHA-256 درایور Wintun و رفع هشدار کاذب Windows Defender:** بررسی هش رسمی `wintun-0.14.1.zip` در گیت‌هاب اکشنز، حذف فلگ فشرده‌سازی جدول سمبل‌ها (`-s`) جهت جلوگیری از تشخیص کاذب هوش مصنوعی ویندوز دیفندر (`Bearfoos.B!ml`) و انتشار فایل `SHA256SUMS.txt`.

---

## ⚡ استخر چند اکانته (افزایش نامحدود سهمیه)

### ❓ چند تا اکانت می‌توان اضافه کرد؟
**کاملاً نامحدود!** هیچ محدودیتی در تعداد اکانت‌های متصل وجود ندارد:
- **۱ اکانت:** ۵۰ گیگابایت در ماه
- **۲ اکانت:** ۱۰۰ گیگابایت در ماه
- **۳ اکانت:** ۱۵۰ گیگابایت در ماه
- **۵ اکانت:** ۲۵۰ گیگابایت در ماه
- **۱۰ اکانت:** ۵۰۰ گیگابایت در ماه

### 🛠️ نحوه افزودن اکانت‌ها (۳ روش مختلف):
1. **روش آسان و خودکار (ایمیل و رمز عبور):**  
   نیازی به گشتن دنبال توکن ندارید! کافیست ایمیل و رمز اکانت‌های دوم، سوم یا بیشتر خود را وارد کنید. برنامه به صورت خودکار کلیدهای امنیتی نشست (PBKDF2-SHA256 + HKDF) را تولید، احراز هویت کرده و ۵۰ گیگابایت سهمیه به استخر شما اضافه می‌کند.
2. **حالت تایید دستی (Manual Verification با توکن یا لینک):**  
   اگر لینک فعال‌سازی ایمیل را در مرورگر سیستم یا گوشی باز کردید، برای دور زدن مشکلات ریدایرکت خودکار، کافیست توکن احراز هویت، JWT یا آدرس نوار مرورگر را در تب تایید دستی Paste کنید.
3. **ورود مستقیم توکن‌های خام (Raw Tokens):**  
   امکان وارد کردن دسته‌ای توکن‌های هگزادسیمال ۳۲ یا ۶۴ کاراکتری نشست فایرفاکس (هر خط یک توکن).

---

## 🚀 مشخصات فنی و قابلیت‌ها

| عنوان | توضیح فنی |
| :--- | :--- |
| **کارت شبکه Wintun لایه ۳** | ایجاد کارت شبکه مجازی `FoxyVPN-Adapter` با آی‌پی `10.0.0.2/24` و هدایت امن و پرسرعت کل ترافیک ویندوز (`0.0.0.0/0`). |
| **پراکسی محلی WinINET** | راه‌اندازی پراکسی محلی `SOCKS5 (127.0.0.1:1080)` و اعمال خودکار در رجیستری ویندوز برای سازگاری کامل نرم‌افزارها. |
| **تکنولوژی ضد فیلترینگ TLS SNI Split** | شکستن پکت‌های اولیه ClientHello در نقطه حساس SNI همراه با فلگ `TCP_NODELAY` جهت دور زدن بازرسی عمیق بسته‌ها (DPI). |
| **DNS امن بر بستر DoH** | ارسال تمام کوئری‌های DNS از داخل تونل رمزنگاری‌شده به سرورهای کلودفلر (`1.1.1.1`)، کواد۹ (`9.9.9.9`) و گوگل (`8.8.8.8`). |
| **کیل سوییچ (Kill Switch)** | قطع فوری اینترنت در صورت قطعی موقت تونل برای حفظ امنیت و عدم لو رفتن آی‌پی واقعی. |

---

## 🤝 همگام‌سازی و اطلاع به سازنده نسخه اندروید
این پروژه ویندوزی بر پایه معماری ارزشمند نسخه اندروید **[Vauth/FoxyVPN](https://github.com/vauth/foxyvpn)** و کلاینت مرجع Go توسعه یافته است.

---

## 📥 دانلود نسخه‌های آماده (Releases)

از بخش **[GitHub Releases](https://github.com/mostafa5804/foxyvpn_windows/releases)** می‌توانید خروجی‌های آماده را دریافت کنید:
- 📦 **`FoxyVPN-Portable.exe` (پیشنهادی):** نسخه تک‌فایل بدون نیاز به نصب، درایور Wintun در دل فایل تعبیه شده و بلافاصله اجرا می‌شود.
- 💿 **`FoxyVPN-Setup.exe`:** فایل نصبی رسمی با شورتکات دسکتاپ و قابلیت حذف از کنترل‌پنل ویندوز.
- 🗜️ **`FoxyVPN-Windows-amd64.zip`:** نسخه فشرده حاوی فایل اجرایی و راهنما.

---

## 🛠️ دستورات کامپایل محلی (Local Build)

```powershell
# ۱. نصب کتابخانه‌های فرانت‌اند
npm install

# ۲. کامپایل باینری بومی ویندوز ۶۴ بیتی با Wails
wails build -platform windows/amd64 -clean -o FoxyVPN.exe
```

---

## 📄 مجوز انتشار (License)
این پروژه تحت مجوز متن‌باز **MIT License** منتشر شده است. استفاده، بهینه‌سازی و بازنشر آن کاملاً آزاد است.
