<div align="center">

<img src="public/foxyvpn-windows-logo.svg" alt="FoxyVPN Windows Logo" width="130" height="130" />

# 🦊🪟 FoxyVPN Windows

**کلاینت دسکتاپ بومی، رایگان و بدون نیاز به اشتراک Firefox VPN برای ویندوز ۱۰ و ۱۱**

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%20%2F%2011%20(x64)-0078D6?style=for-the-badge&logo=windows&logoColor=white)](#)
[![Framework](https://img.shields.io/badge/Built%20With-Wails%20v2%20%2B%20Go%201.23-00ADD8?style=for-the-badge&logo=go&logoColor=white)](#)
[![Allowance](https://img.shields.io/badge/Monthly%20Traffic-50%20GB%20Free-FE6C31?style=for-the-badge&logo=firefox-browser&logoColor=white)](#)
[![Driver](https://img.shields.io/badge/Network%20Driver-Wintun%20v0.14.1-10B981?style=for-the-badge)](#)
[![License](https://img.shields.io/badge/License-MIT-F59E0B?style=for-the-badge)](LICENSE)

<br />

> 💡 **پورت دسکتاپ ویندوز بر پایهٔ نسخهٔ اندروید [FoxyVPN](https://github.com/vauth/foxyvpn):**  
> این پروژه نسخهٔ بومی و بهینه‌سازی‌شدهٔ ویندوز است که با الهام و بهره‌گیری از معماری پروتکل نسخهٔ محبوب اندروید یعنی **[`Vauth/FoxyVPN`](https://github.com/vauth/foxyvpn)** (و هستهٔ مرجع Go در [`firefox-vpn-client`](https://github.com/UjuiUjuMandan/firefox-vpn-client)) توسعه یافته است و قابلیت **ثبت‌نام مستقیم درون‌برنامه‌ای (In-App Sign Up)** را نیز به آن اضافه کرده است.

</div>

---

## ✨ معرفی FoxyVPN Windows

**FoxyVPN Windows** یک کلاینت دسکتاپ مدرن و سبک برای سیستم‌عامل ویندوز است که به شما امکان می‌دهد از **سهمیهٔ ۵۰ گیگابایت ترافیک ماهانهٔ رایگان** که موزیلا روی هر اکانت فایرفاکس (ویژهٔ VPN داخلی مرورگر فایرفاکس بر بستر سرورهای لبهٔ **Fastly**) ارائه می‌دهد، در **کل سیستم‌عامل ویندوز** استفاده کنید.

برخلاف نسخهٔ اندروید که کاربر ناچار بود ابتدا در وب‌سایت موزیلا ثبت‌نام کند و سپس وارد برنامه شود، در **FoxyVPN Windows** علاوه بر بخش **ورود با اکانت قبلی**، بخش **ثبت‌نام مستقیم داخل برنامه (In-App Registration)** نیز تعبیه شده است تا بتوانید در چند ثانیه اکانت جدید بسازید، کد ۶ رقمی ایمیل را وارد کنید و ۵۰ گیگابایت رایگان ماهانه را فعال نمایید.

---

## 🚀 ویژگی‌های کلیدی (Features)

| آیکون | قابلیت | توضیحات فنی |
| :---: | :--- | :--- |
| 🆕 | **ثبت‌نام مستقیم داخل برنامه (In-App Sign Up)** | ساخت اکانت جدید فایرفاکس مستقیماً از داخل برنامه (`/v1/account/create`)، تایید کد ۶ رقمی ایمیل و فعال‌سازی خودکار سهمیه ۵۰ گیگابایتی (`/api/v1/fpn/activate`). |
| 🔑 | **ورود با اکانت قبلی + استخر توکن (Token Pool)** | پشتیبانی از ورود با ایمیل/رمز عبور برای اکانت‌های از قبل ثبت‌نام‌شده + قابلیت **Token Pool** برای چرخش خودکار بین چند اکانت ۵۰ گیگابایتی بدون قطعی اتصال! |
| 🤖 | **حل‌کنندهٔ خودکار چالش ضدربات Fastly** | مجهز به ماژول `FastlyChallengeSolver` برای حل خودکار خطای `HTTP 406 Not Acceptable` از طریق محاسبهٔ Proof-of-Work (`SHA-256`) در پس‌زمینه. |
| 🛡️ | **دو حالت شبکه: Wintun TUN و System Proxy** | **۱. حالت Full System (Wintun):** ایجاد کارت شبکه مجازی `FoxyVPN-Adapter` (`10.0.0.2/24`) برای تونل کردن کل ویندوز.<br>**۲. حالت System Proxy:** راه‌اندازی پراکسی `SOCKS5 (127.0.0.1:1080)` و تنظیم خودکار رجیستری ویندوز (`WinINET`). |
| ⚡ | **دور زدن فیلترینگ (Anti-DPI & TLS Split)** | شکستن پکت `TLS ClientHello` در محل اکستنشن **SNI** (`Record Split` و `TCP Segment Split`)، قابلیت تعریف IP مستقیم Fastly و پراکسی Upstream. |
| 🔒 | **DNS امن و رمزنگاری‌شده (DoH)** | شکار تمام درخواست‌های UDP پورت ۵۳ در لایه Wintun و ارسال امن از داخل تانل HTTP/2 به سرورهای DoH (`1.1.1.1`، `8.8.8.8` و `9.9.9.9`). |
| 🌍 | **تأییدیهٔ واقعی آی‌پی خروجی (Exit Check)** | تست خودکار مسیر دیتا از طریق `cloudflare.com/cdn-cgi/trace` و نمایش IP خروجی، پرچم کشور و پینگ واقعی. |
| 🎨 | **رابط کاربری Windows 11 Fluent Bento UI** | طراحی چشم‌نواز دسکتاپ با تم تاریک و روشن (Dark/Light)، نمودار زندهٔ سرعت دانلود و آپلود، گیج مصرف ۵۰ گیگابایت و کنسول لاگ تاشو. |

---

## 🏗️ معماری فنی پروژه (Architecture)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    FoxyVPN Windows (Wails v2 UI)                        │
│   [Dashboard]   [In-App Sign Up / Sign In / Token Pool]   [Settings]    │
└───────────────────┬─────────────────────────────────────┬───────────────┘
                    │                                     │
         (Control Plane: FxA & Guardian)        (Data Plane: Wintun / Proxy)
                    ▼                                     ▼
┌───────────────────────────────────────┐   ┌─────────────────────────────┐
│ pkg/auth/guardian.go                  │   │ pkg/vpn/wintun_windows.go   │
│ • PBKDF2 quickStretch + HKDF          │   │ • Wintun "FoxyVPN-Adapter"  │
│ • Hawk HMAC-SHA256 Request Signer     │   │ • 10.0.0.2/24 + Split Route │
│ • Fastly HTTP 406 PoW Solver          │   │ • WinINET Registry Proxy    │
│ • vpn.mozilla.org/api/v1/fpn/*        │   └──────────────┬──────────────┘
│ • Remote Settings Edge Server List    │                  │
└───────────────────────────────────────┘                  ▼
                                            ┌─────────────────────────────┐
                                            │ pkg/vpn/tunnel.go           │
                                            │ • HTTP/2 CONNECT over TLS   │
                                            │ • TLS ClientHello Splitter  │
                                            │ • UDP/53 -> DoH DNS Relay   │
                                            │ • *.m1.fastly-masque.net    │
                                            └─────────────────────────────┘
```

---

## 📖 راهنمای استفاده (How to Use)

1. 📥 فایل فشردهٔ **`FoxyVPN-Windows-amd64.zip`** را از بخش **[Releases](../../releases)** (یا Artifacts گیت‌هاب اکشنز) دانلود و استخراج کنید.
2. 🖥️ فایل **`FoxyVPN.exe`** را اجرا کنید (به دلیل نیاز درایور `wintun.dll` به ساخت کارت شبکه، پنجرهٔ UAC ویندوز باز می‌شود؛ گزینهٔ **Yes** را بزنید).
3. 🔐 وارد تب **Sign In / Register** شوید:
   * **اگر از قبل اکانت فایرفاکس دارید:** در تب `Sign In (Existing)` ایمیل و رمز عبور خود را وارد کنید.
   * **اگر اکانت ندارید:** در تب `Create Account` ایمیل و رمز عبور دلخواهتان را بزنید تا اکانت مستقیماً ساخته شود.
   * کد تأیید ۶ رقمی ارسال‌شده به ایمیل را وارد کنید تا سهمیهٔ **۵۰ گیگابایت ماهانه** فعال شود.
4. 🌐 از بخش **Change Location** کشور و شهر دلخواه (مثلاً آلمان - فرانکفورت، هلند - آمستردام، آمریکا - نیویورک و...) را انتخاب کنید.
5. 🟢 دکمهٔ بزرگ **Tap to Connect** را بزنید تا اتصال برقرار شود!

---

## ⚙️ بیلد اتوماتیک با GitHub Actions (CI/CD)

این مخزن مجهز به پایپ‌لاین کامل **`.github/workflows/build-windows.yml`** است. به محض اینکه کد را در گیت‌هاب خود Push کنید، سرور ویندوز گیت‌هاب به صورت خودکار مراحل زیر را انجام می‌دهد:

1. نصب **Go 1.23**، **Node.js 22** و **Wails v2 CLI**.
2. اجرای تست‌های واحد (`node --test`).
3. تزریق منیفست دسترسی ادمین (`manifest.xml` -> `requireAdministrator`).
4. کامپایل باینری بومی ویندوز (`FoxyVPN.exe`).
5. دانلود خودکار درایور رسمی **`wintun.dll` (نسخهٔ `0.14.1 amd64`)** از سایت رسمی `wintun.net` و قرار دادن آن کنار فایل اجرایی.
6. بسته‌بندی فایل نهایی **`FoxyVPN-Windows-amd64.zip`** در بخش **Artifacts** و انتشار خودکار در **GitHub Releases** هنگام ثبت تگ نسخه (مثلاً `v1.2.0`).

---

## 🙏 قدردانی و منابع (Acknowledgements)

* 📱 **[Vauth/FoxyVPN](https://github.com/vauth/foxyvpn)** — نسخهٔ فوق‌العادهٔ اندروید FoxyVPN که این پروژهٔ ویندوزی بر اساس معماری، منطق کلاینت Guardian و تکنیک‌های ضد فیلترینگ آن طراحی و پورت شده است.
* 🐹 **[UjuiUjuMandan/firefox-vpn-client](https://github.com/UjuiUjuMandan/firefox-vpn-client)** — کلاینت مرجع Go برای پروتکل Mozilla FPN و حل‌کنندهٔ چالش Fastly.
* 🔌 **[WireGuard Wintun Driver](https://www.wintun.net/)** — درایور کرنل فوق‌سریع لایه ۳ کارت شبکه مجازی برای ویندوز.
* 🖥️ **[Wails v2 Framework](https://wails.io/)** — فریم‌ورک توسعهٔ اپلیکیشن‌های دسکتاپ با Go و WebView2.
