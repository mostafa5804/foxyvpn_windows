export type Language = 'fa' | 'en';

export interface Translations {
  appName: string;
  version: string;
  dashboard: string;
  auth: string;
  settings: string;
  about: string;
  quickConnect: string;
  disconnectTunnel: string;
  connected: string;
  disconnected: string;
  connecting: string;
  tapToConnect: string;
  dialing: string;
  tunnelStatus: string;
  adapterMode: string;
  lightTheme: string;
  darkTheme: string;
  languageToggle: string;
  notSignedIn: string;
  signInOrRegister: string;
  planActive: string;
  switchOrAddAccount: string;
  signOut: string;
  changeLocation: string;
  routingEngine: string;
  wintunTunMode: string;
  systemProxyMode: string;
  monthlyAllowanceTitle: string;
  monthlyAllowanceSubtitle: string;
  leftOfTotal: string;
  usedThisCycle: string;
  downloadRate: string;
  uploadRate: string;
  sessionRx: string;
  sessionTx: string;
  realtimeThroughput: string;
  pingRtt: string;
  logsTitle: string;
  copyLogs: string;
  logsCopied: string;
  refresh: string;
  clear: string;
  exitVerifiedNotice: string;
  notTunneled: string;

  // Server Modal
  selectServerTitle: string;
  selectServerSubtitle: string;
  searchServerPlaceholder: string;
  sortLowestPing: string;
  sortCountry: string;
  refreshPings: string;
  refreshingPings: string;
  close: string;
  autoServerTitle: string;
  autoServerDesc: string;
  noServersFound: string;

  // AuthView
  signInTab: string;
  signUpTab: string;
  tokenPoolTab: string;
  emailLabel: string;
  emailPlaceholder: string;
  passwordLabel: string;
  passwordPlaceholder: string;
  confirmPasswordLabel: string;
  confirmPasswordPlaceholder: string;
  signInBtn: string;
  signUpBtn: string;
  connectingServer: string;
  fxaHeroTitle: string;
  fxaHeroSubtitle: string;
  featureSignInTitle: string;
  featureSignInDesc: string;
  featureManualTitle: string;
  featureManualDesc: string;
  featurePoolTitle: string;
  featurePoolDesc: string;

  // Manual Verify & Code
  manualVerifyTab: string;
  otpCodeTab: string;
  browserLinkTab: string;
  manualVerifyTitle: string;
  manualVerifyDesc: string;
  manualVerifyInputLabel: string;
  manualVerifyPlaceholder: string;
  manualVerifySubmitBtn: string;
  sampleLinkBtn: string;
  otpInputLabel: string;
  otpPlaceholder: string;
  otpSubmitBtn: string;
  browserLinkTitle: string;
  browserLinkDesc: string;
  browserLinkBtn: string;
  checkingStatus: string;
  backBtn: string;
  webSignUpNotice: string;

  // Pool
  poolEmailModeBtn: string;
  poolTokenModeBtn: string;
  poolInfoTitle: string;
  poolInfoDesc: string;
  poolEmailLabel: string;
  poolPasswordLabel: string;
  poolAddAccountBtn: string;
  poolRawTokensLabel: string;
  poolRawTokensPlaceholder: string;
  poolRawTokensSample: string;
  poolRawTokensSubmitBtn: string;
  poolListTitle: string;
  poolTotalCapacity: string;
  poolActiveAccountBadge: string;
  poolActivateAccountBtn: string;
  poolDeleteAccountTitle: string;
  accountPoolEmptyNotice: string;

  // About View
  aboutHeroTitle: string;
  aboutHeroDesc: string;
  githubRepoBtn: string;
  githubReleasesBtn: string;
  quotaFeatureTitle: string;
  quotaFeatureDesc: string;
  driverFeatureTitle: string;
  driverFeatureDesc: string;
  antiDpiFeatureTitle: string;
  antiDpiFeatureDesc: string;
  dohFeatureTitle: string;
  dohFeatureDesc: string;
  specsTitle: string;
  appVersionLabel: string;
  coreFrameworkLabel: string;
  networkDriverLabel: string;
  distributionTypeLabel: string;
  portableAndSetup: string;
  openSourceNotice: string;

  // Settings View
  settingsTitle: string;
  settingsSubtitle: string;
  saveSettingsBtn: string;
  settingsSavedAlert: string;
  routingModeLabel: string;
  routingModeDesc: string;
  tlsSplitLabel: string;
  tlsSplitDesc: string;
  dohLabel: string;
  dohDesc: string;
  mtuLabel: string;
  mtuDesc: string;
  killSwitchLabel: string;
  killSwitchDesc: string;
  controlProxyLabel: string;
  controlProxyPlaceholder: string;
  edgeOverrideLabel: string;
  edgeOverridePlaceholder: string;
  fullTunOptionTitle: string;
  fullTunOptionDesc: string;
  proxyOptionTitle: string;
  proxyOptionDesc: string;
  sessionBackupTitle: string;
  sessionBackupDesc: string;
  exportSessionBtn: string;
  importSessionBtn: string;
  sessionSavedToast: string;
  sessionRestoredToast: string;
  portableUpdateNotice: string;

  // v1.0.6 additions
  syncQuotaBtn: string;
  transportProtocolLabel: string;
  protocolHttp2Connect: string;
  protocolHttp2Tls: string;
  protocolMasqueQuic: string;
  protocolAuto: string;
  splitTunnelTitle: string;
  splitModeAll: string;
  splitModeInclude: string;
  splitModeExclude: string;
  splitTunnelDesc: string;
  splitTunnelAppsPlaceholder: string;
  addAppBtn: string;
  localPortsTitle: string;
  socksPortLabel: string;
  httpPortLabel: string;
  allowLanLabel: string;
  allowLanDesc: string;
  fragmentSizeLabel: string;
  fragmentDelayLabel: string;
  blockIpv6Label: string;
  blockIpv6Desc: string;
  aboutSummary: string;
  checkForUpdatesBtn: string;
  checkingUpdates: string;
  updateAvailableTitle: string;
  upToDateNotice: string;
  downloadUpdateBtn: string;
}

export const translations: Record<Language, Translations> = {
  fa: {
    appName: 'FoxyVPN Windows',
    version: '1.0.6',
    dashboard: 'داشبورد',
    auth: 'اکانت و ورود',
    settings: 'تنظیمات تونل',
    about: 'درباره برنامه',
    quickConnect: 'اتصال سریع',
    disconnectTunnel: 'قطع اتصال تونل',
    connected: 'متصل شد',
    disconnected: 'قطع است',
    connecting: 'در حال برقراری اتصال...',
    tapToConnect: 'کلیک برای برقراری اتصال',
    dialing: 'در حال شماره‌گیری...',
    tunnelStatus: 'وضعیت اتصال تونل',
    adapterMode: 'حالت آداپتور',
    lightTheme: 'تم روشن',
    darkTheme: 'تم تاریک',
    languageToggle: 'English',
    notSignedIn: 'وارد نشده‌اید',
    signInOrRegister: 'ورود یا ثبت‌نام اکانت فایرفاکس',
    planActive: 'سهمیه ۵۰ گیگابایت موزیلا فعال است',
    switchOrAddAccount: 'مدیریت و افزودن اکانت',
    signOut: 'خروج از حساب',
    changeLocation: 'تغییر لوکیشن سرور',
    routingEngine: 'موتور مسیریابی:',
    wintunTunMode: 'کارت شبکه Wintun لایه ۳ (10.0.0.2/24) + DoH',
    systemProxyMode: 'پراکسی محلی ویندوز (127.0.0.1:1080)',
    monthlyAllowanceTitle: 'سهمیه ترافیک ماهانه موزیلا',
    monthlyAllowanceSubtitle: '۵۰ گیگابایت ترافیک مرورگر موزیلا در ماه · بدون اشتراک پولی',
    leftOfTotal: 'باقی‌مانده از مجموع',
    usedThisCycle: 'مصرف این ماه:',
    downloadRate: 'سرعت دریافت',
    uploadRate: 'سرعت ارسال',
    sessionRx: 'دریافت نشست:',
    sessionTx: 'ارسال نشست:',
    realtimeThroughput: 'ترافیک زنده استریم HTTP/2',
    pingRtt: 'پینگ زنده:',
    logsTitle: 'کنسول لاگ‌های تشخیصی و کنترل Wintun',
    copyLogs: 'کپی لاگ‌ها',
    logsCopied: 'کپی شد!',
    refresh: 'تازه‌سازی',
    clear: 'پاک‌سازی',
    exitVerifiedNotice: 'آی‌پی تاییدشده با Cloudflare:',
    notTunneled: 'غیرفعال (مستقیم)',

    selectServerTitle: 'انتخاب سرور Fastly Edge',
    selectServerSubtitle: 'نودهای چندگانه پروتکل HTTP/2 CONNECT موزیلا',
    searchServerPlaceholder: 'جستجوی کشور، شهر، یا آدرس هاست...',
    sortLowestPing: 'مرتب‌سازی: کمترین پینگ زنده',
    sortCountry: 'مرتب‌سازی: الفبای کشورها',
    refreshPings: 'تست مجدد پینگ‌ها',
    refreshingPings: 'در حال پینگ گرفتن...',
    close: 'بستن',
    autoServerTitle: 'اتوماتیک (بهترین و نزدیک‌ترین سرور هوشمند)',
    autoServerDesc: 'اتصال خودکار به نود با کمترین پینگ زنده و بهترین پایداری',
    noServersFound: 'هیچ سروری مطابق با جستجوی شما پیدا نشد.',

    signInTab: 'ورود با اکانت قبلی',
    signUpTab: 'ساخت اکانت جدید',
    tokenPoolTab: 'چند اکانته (Token Pool)',
    emailLabel: 'ایمیل اکانت فایرفاکس (Firefox Account Email)',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'رمز عبور (Password)',
    passwordPlaceholder: 'حداقل ۸ کاراکتر',
    confirmPasswordLabel: 'تکرار رمز عبور (Confirm Password)',
    confirmPasswordPlaceholder: 'تکرار همان رمز عبور',
    signInBtn: 'ورود به اکانت فایرفاکس',
    signUpBtn: 'ثبت‌نام اکانت جدید و فعال‌سازی ۵۰ گیگابایت',
    connectingServer: 'در حال ارتباط با سرور فایرفاکس...',
    fxaHeroTitle: 'سهمیه ۵۰ گیگابایت ترافیک ماهانه رایگان با اکانت فایرفاکس',
    fxaHeroSubtitle: 'با اکانت قبلی خود وارد شوید یا اکانت جدید بسازید. سهمیه ۵۰ گیگابایت به ازای هر اکانت به صورت رایگان فعال می‌شود.',
    featureSignInTitle: 'ورود با اکانت قبلی (سریع و آسان)',
    featureSignInDesc: 'کافیست ایمیل و پسورد اکانت فایرفاکس را بزنید تا کد تایید برایتان ارسال شود.',
    featureManualTitle: 'تایید دستی با توکن (Manual Verification)',
    featureManualDesc: 'بدون نیاز به بازگشت خودکار مرورگر، می‌توانید توکن یا لینک تایید را مستقیماً در برنامه وارد کنید.',
    featurePoolTitle: 'افزایش سهمیه با استخر چند اکانته',
    featurePoolDesc: 'با افزودن ایمیل و پسورد اکانت‌های دیگرتان، سهمیه شما به ۱۰۰ یا ۱۵۰ گیگابایت افزایش می‌یابد.',

    manualVerifyTab: 'تایید دستی توکن (Manual)',
    otpCodeTab: 'کد ۶ رقمی ایمیل',
    browserLinkTab: 'لینک در مرورگر',
    manualVerifyTitle: 'حالت تایید دستی توکن (Manual Verification)',
    manualVerifyDesc: 'اگر روی لینک فعال‌سازی ایمیل در مرورگر (فایرفاکس، کروم، گوشی و...) کلیک کردید، نیازی به ریدایرکت خودکار برنامه ندارید! کافیست توکن نشست، JWT یا آدرس نوار مرورگر را در کادر زیر قرار دهید:',
    manualVerifyInputLabel: 'توکن احراز هویت یا نشانی بازشده در مرورگر',
    manualVerifyPlaceholder: 'توکن احراز هویت (شروع با ey...)، کد ۶ رقمی یا آدرس کامل نوار مرورگر...',
    manualVerifySubmitBtn: 'تایید دستی توکن و فعال‌سازی سهمیه',
    sampleLinkBtn: 'نمونه لینک مرورگر',
    otpInputLabel: 'کد تایید ۶ رقمی ایمیل‌شده',
    otpPlaceholder: 'کد ۶ رقمی (مثل 482910)',
    otpSubmitBtn: 'تایید کد ۶ رقمی',
    browserLinkTitle: 'بررسی خودکار وضعیت باز شدن لینک در مرورگر',
    browserLinkDesc: 'اگر لینک فعال‌سازی را در مرورگر سیستم یا گوشی باز کرده‌اید، دکمه زیر را بزنید تا وضعیت نشست مستقیماً از موزیلا استعلام شود:',
    browserLinkBtn: 'لینک ایمیل را در مرورگر باز کردم — بررسی و ورود خودکار',
    checkingStatus: 'در حال بررسی وضعیت تایید در سرور...',
    backBtn: 'بازگشت',
    webSignUpNotice: 'ثبت‌نام مستقیم در وبسایت رسمی فایرفاکس:',

    poolEmailModeBtn: 'افزودن با ایمیل و رمز (آسان و خودکار)',
    poolTokenModeBtn: 'ورود مستقیم توکن (روش پیشرفته)',
    poolInfoTitle: 'نحوه افزایش سهمیه و افزودن چند اکانت (بدون نیاز به پیدا کردن توکن)',
    poolInfoDesc: 'توکن همان کلید امنیتی نشست است که برنامه بعد از لاگین به دست می‌آورد. نیازی نیست دستی دنبال آن بگردید! فقط کافیست ایمیل و پسورد اکانت‌های دیگرتان را در کادرهای زیر وارد کنید تا خودکار ۵۰ گیگابایت به سهمیه شما اضافه شود.',
    poolEmailLabel: 'ایمیل اکانت دوم یا سوم فایرفاکس',
    poolPasswordLabel: 'رمز عبور این اکانت',
    poolAddAccountBtn: 'افزودن این اکانت به استخر (+50 GB سهمیه)',
    poolRawTokensLabel: 'توکن‌های نشست خام (FxA Session Tokens)',
    poolRawTokensPlaceholder: 'توکن‌های هگزادسیمال ۳۲ یا ۶۴ رقمی (هر خط یک توکن)...',
    poolRawTokensSample: 'نمونه توکن (100 GB)',
    poolRawTokensSubmitBtn: 'فعال‌سازی استخر توکن‌ها',
    poolListTitle: 'اکانت‌های فعال در استخر شما',
    poolTotalCapacity: 'مجموع سهمیه:',
    poolActiveAccountBadge: 'اکانت فعال',
    poolActivateAccountBtn: 'فعال‌سازی',
    poolDeleteAccountTitle: 'حذف از استخر',
    accountPoolEmptyNotice: 'هنوز اکانت ثانویه‌ای اضافه نکرده‌اید. با وارد کردن ایمیل و رمز اکانت جدید، ۵۰ گیگابایت سهمیه به استخر شما اضافه می‌شود.',

    aboutHeroTitle: 'FoxyVPN Windows',
    aboutHeroDesc: 'کلاینت بومی، پرتابل و متن‌باز ویندوز برای استفاده از سهمیه ۵۰ گیگابایت ترافیک ماهانه رایگان موزیلا بر بستر سرورهای Fastly با پروتکل HTTP/2 CONNECT و کارت شبکه مجازی Wintun.',
    githubRepoBtn: 'مخزن گیت‌هاب (GitHub)',
    githubReleasesBtn: 'دانلود نسخه‌های جدید (Releases)',
    quotaFeatureTitle: 'سهمیه ۵۰ گیگابایت ماهانه موزیلا',
    quotaFeatureDesc: 'استفاده مستقیم از ترافیک مرورگر فایرفاکس بدون نیاز به خرید اشتراک، با قابلیت اتصال استخر چند اکانته جهت افزایش سهمیه.',
    driverFeatureTitle: 'درایور اختصاصی Wintun + System Proxy',
    driverFeatureDesc: 'ایجاد کارت شبکه مجازی Wintun برای مسیریابی امن و پرسرعت لایه ۳، همراه با پراکسی محلی WinINET جهت سازگاری کامل نرم‌افزارها.',
    antiDpiFeatureTitle: 'تکنولوژی ضد فیلترینگ TLS SNI Split',
    antiDpiFeatureDesc: 'شکستن پکت‌های اولیه ClientHello در نقطه حساس SNI همراه با TCP_NODELAY جهت دور زدن موانع بازرسی عمیق بسته‌ها (DPI).',
    dohFeatureTitle: 'DNS امن بر بستر DoH',
    dohFeatureDesc: 'هدایت تمام درخواست‌های DNS به سرورهای رمزنگاری‌شده Cloudflare و Quad9 از داخل تونل HTTP/2 جهت جلوگیری از مسمومیت و ردیابی DNS.',
    specsTitle: 'مشخصات فنی و پکیج انتشار',
    appVersionLabel: 'نسخه برنامه:',
    coreFrameworkLabel: 'فریم‌ورک هسته:',
    networkDriverLabel: 'درایور شبکه:',
    distributionTypeLabel: 'نوع توزیع:',
    portableAndSetup: 'پرتابل (Portable) و نصبی (Setup)',
    openSourceNotice: 'توسعه‌یافته بر پایه نسخه متن‌باز Vauth/FoxyVPN و هسته Go · مجوز MIT',

    settingsTitle: 'تنظیمات پیشرفته هسته تونل',
    settingsSubtitle: 'پیکربندی شبکه Wintun، تکنولوژی ضد فیلترینگ TLS و DNS اختصاصی',
    saveSettingsBtn: 'ذخیره و اعمال تنظیمات',
    settingsSavedAlert: 'تنظیمات با موفقیت ذخیره و در هسته شبکه اعمال شد.',
    routingModeLabel: 'حالت هدایت ترافیک در ویندوز (Routing Mode)',
    routingModeDesc: 'حالت Wintun لایه ۳ کل ترافیک ویندوز را از کارت شبکه مجازی عبور می‌دهد. حالت پراکسی فقط ترافیک مرورگرها و نرم‌افزارهای پراکسی‌پذیر را هدایت می‌کند.',
    fullTunOptionTitle: 'کارت شبکه کامل سیستم (Wintun TUN)',
    fullTunOptionDesc: 'ایجاد کارت شبکه مجازی FoxyVPN-Adapter (10.0.0.2/24) و هدایت کل ترافیک ویندوز (0.0.0.0/0).',
    proxyOptionTitle: 'پراکسی محلی ویندوز (SOCKS5 / WinINET)',
    proxyOptionDesc: 'فعال‌سازی روی 127.0.0.1:1080 و اعمال در رجیستری ویندوز بدون نیاز به درایور Wintun.',
    tlsSplitLabel: 'تکنولوژی دور زدن فیلترینگ (Anti-DPI TLS Split)',
    tlsSplitDesc: 'شکستن پکت‌های TLS ClientHello به بخش‌های کوچکتر جهت جلوگیری از شناسایی توسط سامانه‌های فیلترینگ.',
    dohLabel: 'سرور امن DNS over HTTPS',
    dohDesc: 'رمزنگاری تمامی درخواست‌های DNS برای جلوگیری از مسمومیت و شنود آدرس‌ها.',
    mtuLabel: 'حداکثر اندازه بسته (MTU)',
    mtuDesc: 'مقدار بهینه ۱۳۸۰ بایت برای بسته‌های رمزنگاری‌شده HTTP/2 CONNECT.',
    killSwitchLabel: 'سوئیچ قطع اضطراری اینترنت (Kill Switch)',
    killSwitchDesc: 'مسدودسازی اینترنت سیستم در صورت قطع ناگهانی تونل جهت جلوگیری از لو رفتن آی‌پی واقعی.',
    controlProxyLabel: 'پراکسی کنترل‌پنل ورود موزیلا (اختیاری)',
    controlProxyPlaceholder: 'مثال: socks5://127.0.0.1:10808 یا http://127.0.0.1:7890',
    edgeOverrideLabel: 'آی‌پی اختصاصی سرور فاستلی (Edge IP Override)',
    edgeOverridePlaceholder: 'مثال: 23.235.42.8',
    sessionBackupTitle: 'ذخیره خودکار باینری (data/account.bin)',
    sessionBackupDesc: 'اکانت‌ها و توکن‌های شما به صورت رمزنگاری‌شده در فایل باینری data/account.bin ذخیره می‌شوند تا هنگام آپدیت نسخه پرتابل یا نصبی نیازی به لاگین مجدد نباشد.',
    exportSessionBtn: 'پشتیبان‌گیری فایل account.bin',
    importSessionBtn: 'بازیابی از account.bin',
    sessionSavedToast: 'فایل باینری data/account.bin با موفقیت ذخیره شد',
    sessionRestoredToast: 'اکانت‌ها از فایل باینری data/account.bin بازیابی شدند',
    portableUpdateNotice: 'پشتیبانی از آپدیت بدون لاگین مجدد (Portable & Setup)',

    syncQuotaBtn: 'استعلام زنده سهمیه باقی‌مانده از سرور موزیلا',
    transportProtocolLabel: 'پروتکل انتقال تونل (Transport Protocol)',
    protocolHttp2Connect: 'HTTP/2 CONNECT · پورت 2499 (پیشنهادی)',
    protocolHttp2Tls: 'HTTP/2 TLS · پورت 443 (ضد فایروال)',
    protocolMasqueQuic: 'MASQUE HTTP/3 QUIC · کمترین پینگ',
    protocolAuto: 'انتخاب هوشمند خودکار (Auto Fallback)',
    splitTunnelTitle: 'تونل برنامه‌ها (Per-App Split Tunneling)',
    splitModeAll: 'همه برنامه‌ها',
    splitModeInclude: 'فقط انتخابی‌ها',
    splitModeExclude: 'استثنا (بدون فیلتر)',
    splitTunnelDesc: 'برنامه‌های موردنظر را انتخاب کنید یا نام فایل اجرایی (.exe) را اضافه نمایید:',
    splitTunnelAppsPlaceholder: 'نام برنامه (مثال: chrome.exe)',
    addAppBtn: 'افزودن',
    localPortsTitle: 'پورت‌های پراکسی محلی و اشتراک شبکه',
    socksPortLabel: 'پورت SOCKS5 محلی',
    httpPortLabel: 'پورت HTTP محلی',
    allowLanLabel: 'اشتراک‌گذاری در شبکه محلی (Allow LAN)',
    allowLanDesc: 'امکان اتصال گوشی و سایر دستگاه‌های وای‌فای به پراکسی این سیستم',
    fragmentSizeLabel: 'اندازه قطعه (بایت)',
    fragmentDelayLabel: 'وقفه ارسال (ms)',
    blockIpv6Label: 'مسدودسازی نشت IPv6 (IPv6 Leak Block)',
    blockIpv6Desc: 'جلوگیری از لو رفتن آی‌پی واقعی از طریق ترافیک IPv6 خارج از تونل',
    aboutSummary: 'کلاینت سریع و بومی ویندوز برای استفاده از ۵۰ گیگابایت اینترنت ماهانه رایگان موزیلا روی ۳۸ سرور Fastly.',
    checkForUpdatesBtn: 'بررسی نسخه جدید برنامه',
    checkingUpdates: 'در حال بررسی آخرین نسخه در گیت‌هاب...',
    updateAvailableTitle: 'نسخه جدید منتشر شده است',
    upToDateNotice: 'شما از آخرین نسخه استفاده می‌کنید',
    downloadUpdateBtn: 'دانلود نسخه جدید',
  },
  en: {
    appName: 'FoxyVPN Windows',
    version: '1.0.6',
    dashboard: 'Dashboard',
    auth: 'Account',
    settings: 'Tunnel Settings',
    about: 'About App',
    quickConnect: 'Quick Connect',
    disconnectTunnel: 'Disconnect Tunnel',
    connected: 'Connected',
    disconnected: 'Disconnected',
    connecting: 'Connecting to Fastly...',
    tapToConnect: 'Tap to Connect',
    dialing: 'Dialing...',
    tunnelStatus: 'Tunnel Status',
    adapterMode: 'Adapter Mode',
    lightTheme: 'Light Theme',
    darkTheme: 'Dark Theme',
    languageToggle: 'فارسی',
    notSignedIn: 'Not signed in',
    signInOrRegister: 'Sign In or Register Firefox Account',
    planActive: 'Mozilla Guardian 50 GB Plan Active',
    switchOrAddAccount: 'Switch or Add Account',
    signOut: 'Sign Out',
    changeLocation: 'Change Location',
    routingEngine: 'Routing Engine:',
    wintunTunMode: 'Wintun Layer-3 TUN Adapter (10.0.0.2/24) + DoH',
    systemProxyMode: 'WinINET Local Proxy (127.0.0.1:1080)',
    monthlyAllowanceTitle: 'Mozilla Guardian Monthly Allowance',
    monthlyAllowanceSubtitle: 'Free 50 GB/month Mozilla browser VPN quota · No subscription required',
    leftOfTotal: 'left of',
    usedThisCycle: 'Used this cycle:',
    downloadRate: 'Download Rate',
    uploadRate: 'Upload Rate',
    sessionRx: 'Session RX:',
    sessionTx: 'Session TX:',
    realtimeThroughput: 'Real-Time HTTP/2 Stream Throughput',
    pingRtt: 'Live Ping:',
    logsTitle: 'Wintun & Guardian Diagnostics Control-Plane Logs',
    copyLogs: 'Copy Logs',
    logsCopied: 'Copied!',
    refresh: 'Refresh',
    clear: 'Clear',
    exitVerifiedNotice: 'Exit IP verified via Cloudflare:',
    notTunneled: 'Not Tunneled',

    selectServerTitle: 'Select Fastly Edge Location',
    selectServerSubtitle: 'Mozilla Remote Settings HTTP/2 CONNECT Multiplexed Nodes',
    searchServerPlaceholder: 'Search country, city, or edge host...',
    sortLowestPing: 'Sort: Lowest Live Ping',
    sortCountry: 'Sort: Country A–Z',
    refreshPings: 'Refresh Live Pings',
    refreshingPings: 'Pinging servers...',
    close: 'Close',
    autoServerTitle: 'Automatic (Best & Nearest Server)',
    autoServerDesc: 'Automatically connects to the node with lowest live ping and highest stability',
    noServersFound: 'No Fastly edge servers match your search.',

    signInTab: 'Sign In with Existing Account',
    signUpTab: 'Register New Account',
    tokenPoolTab: 'Multi-Account (Token Pool)',
    emailLabel: 'Firefox Account Email',
    emailPlaceholder: 'you@example.com',
    passwordLabel: 'Password',
    passwordPlaceholder: 'At least 8 characters',
    confirmPasswordLabel: 'Confirm Password',
    confirmPasswordPlaceholder: 'Re-enter same password',
    signInBtn: 'Sign In to Firefox Account',
    signUpBtn: 'Register Account & Activate 50 GB',
    connectingServer: 'Connecting to Firefox servers...',
    fxaHeroTitle: 'Free 50 GB Monthly Traffic with Firefox Account',
    fxaHeroSubtitle: 'Sign in with your existing Firefox Account or create a new one. Free 50 GB quota activates automatically per account.',
    featureSignInTitle: 'Sign In with Existing Account',
    featureSignInDesc: 'Simply enter your Firefox Account email and password to receive a 6-digit confirmation code.',
    featureManualTitle: 'Manual Verification with Token',
    featureManualDesc: 'After clicking the activation link in your browser, paste the token or redirected URL directly to bypass auto-redirect issues.',
    featurePoolTitle: 'Increase Quota with Multi-Account Pool',
    featurePoolDesc: 'Add secondary or tertiary accounts with email & password to combine quota up to 100 GB or 150 GB.',

    manualVerifyTab: 'Manual Token Verify',
    otpCodeTab: 'Email 6-Digit OTP',
    browserLinkTab: 'Browser Link',
    manualVerifyTitle: 'Manual Verification Mode',
    manualVerifyDesc: 'If you clicked the email link in your browser (Firefox, Chrome, phone, etc.), you do not need automatic browser redirects! Simply paste the session token, JWT, or the browser address bar URL below:',
    manualVerifyInputLabel: 'Authentication Token or Browser Redirect URL',
    manualVerifyPlaceholder: 'Paste JWT (starts with ey...), hex token, 6-digit code, or full browser URL...',
    manualVerifySubmitBtn: 'Verify Token & Activate Quota',
    sampleLinkBtn: 'Sample Browser Link',
    otpInputLabel: '6-Digit Email Confirmation Code',
    otpPlaceholder: '6-digit code (e.g. 482910)',
    otpSubmitBtn: 'Submit 6-Digit Code',
    browserLinkTitle: 'Check Browser Link Status',
    browserLinkDesc: 'If you already opened the verification link in your browser, click below to verify session status directly with Mozilla servers:',
    browserLinkBtn: 'I Opened the Email Link — Verify & Connect Automatically',
    checkingStatus: 'Checking verification status with Mozilla servers...',
    backBtn: 'Back',
    webSignUpNotice: 'Direct registration on official Mozilla site:',

    poolEmailModeBtn: 'Add with Email & Password (Easy & Auto)',
    poolTokenModeBtn: 'Direct Token Input (Advanced)',
    poolInfoTitle: 'How to increase quota and add multiple accounts (No token hunting needed)',
    poolInfoDesc: 'A token is the secure session key created when you sign in. You do not need to look for it! Just type the email & password of your second/third account below, and the app will automatically authenticate and add +50 GB to your allowance.',
    poolEmailLabel: 'Secondary / Tertiary Firefox Email',
    poolPasswordLabel: 'Account Password',
    poolAddAccountBtn: 'Add This Account to Pool (+50 GB Quota)',
    poolRawTokensLabel: 'Raw FxA Session Tokens',
    poolRawTokensPlaceholder: '32- or 64-character hexadecimal tokens (one per line)...',
    poolRawTokensSample: 'Sample Tokens (100 GB)',
    poolRawTokensSubmitBtn: 'Activate Token Pool',
    poolListTitle: 'Active Accounts in Your Pool',
    poolTotalCapacity: 'Total Capacity:',
    poolActiveAccountBadge: 'Active Account',
    poolActivateAccountBtn: 'Activate',
    poolDeleteAccountTitle: 'Remove from pool',
    accountPoolEmptyNotice: 'No secondary accounts added yet. Adding new accounts increases your monthly pool by +50 GB each.',

    aboutHeroTitle: 'FoxyVPN Windows',
    aboutHeroDesc: 'Native, portable, and open-source Windows desktop VPN client utilizing Mozilla Guardian 50 GB monthly free allowance over Fastly HTTP/2 CONNECT and Wintun virtual network adapter.',
    githubRepoBtn: 'GitHub Repository',
    githubReleasesBtn: 'Download Releases',
    quotaFeatureTitle: '50 GB Monthly Mozilla Quota',
    quotaFeatureDesc: 'Direct access to Firefox browser VPN allowance without paying for subscription, with multi-account pool support to expand bandwidth.',
    driverFeatureTitle: 'Dedicated Wintun Driver + System Proxy',
    driverFeatureDesc: 'Creates a Layer-3 virtual network interface for system-wide fast routing alongside WinINET local proxy for software compatibility.',
    antiDpiFeatureTitle: 'Anti-DPI TLS SNI Split Technology',
    antiDpiFeatureDesc: 'Fragments initial TLS ClientHello packets at the SNI boundary with TCP_NODELAY to bypass Deep Packet Inspection (DPI) filtering.',
    dohFeatureTitle: 'Secure DNS over DoH',
    dohFeatureDesc: 'Directs all DNS lookups to encrypted Cloudflare and Quad9 servers through the HTTP/2 tunnel to prevent poisoning and snooping.',
    specsTitle: 'Technical Specifications & Distribution',
    appVersionLabel: 'App Version:',
    coreFrameworkLabel: 'Core Framework:',
    networkDriverLabel: 'Network Driver:',
    distributionTypeLabel: 'Package Type:',
    portableAndSetup: 'Portable Executable & Setup Installer',
    openSourceNotice: 'Built upon open-source Vauth/FoxyVPN and Go core · MIT License',

    settingsTitle: 'Advanced Tunnel Core Settings',
    settingsSubtitle: 'Configure Wintun networking, Anti-DPI TLS fragmentation, and custom DNS',
    saveSettingsBtn: 'Save and Apply Settings',
    settingsSavedAlert: 'Settings successfully saved and applied to networking core.',
    routingModeLabel: 'Windows Routing Mode',
    routingModeDesc: 'Wintun Layer-3 routes all system Windows traffic through the adapter. System Proxy routes browser and proxy-aware applications.',
    fullTunOptionTitle: 'Full System (Wintun TUN)',
    fullTunOptionDesc: 'Spawns FoxyVPN-Adapter (10.0.0.2/24) and routes all system traffic (0.0.0.0/0).',
    proxyOptionTitle: 'System Proxy (SOCKS5 / WinINET)',
    proxyOptionDesc: 'Listens on 127.0.0.1:1080 & updates Windows Registry Proxy without requiring Wintun driver.',
    tlsSplitLabel: 'Anti-DPI TLS Split Mode',
    tlsSplitDesc: 'Fragments TLS ClientHello packets into smaller segments to prevent DPI firewall detection.',
    dohLabel: 'DNS over HTTPS Provider',
    dohDesc: 'Encrypts all DNS queries to prevent ISP spoofing and poisoning.',
    mtuLabel: 'Maximum Transmission Unit (MTU)',
    mtuDesc: 'Optimal value of 1380 bytes for HTTP/2 CONNECT encrypted packets.',
    killSwitchLabel: 'Kill Switch',
    killSwitchDesc: 'Blocks non-tunneled internet traffic if the connection drops unexpectedly to prevent IP leaks.',
    controlProxyLabel: 'Control-Plane Mozilla Proxy (Optional)',
    controlProxyPlaceholder: 'e.g. socks5://127.0.0.1:10808 or http://127.0.0.1:7890',
    edgeOverrideLabel: 'Fastly Edge IP Override (Optional)',
    edgeOverridePlaceholder: 'e.g. 23.235.42.8',
    sessionBackupTitle: 'Auto Binary Storage (data/account.bin)',
    sessionBackupDesc: 'Accounts and session tokens are automatically encrypted into data/account.bin (DPAPI + AES-256-GCM) so Portable and Setup updates never require signing in again.',
    exportSessionBtn: 'Export data/account.bin',
    importSessionBtn: 'Restore account.bin',
    sessionSavedToast: 'Binary store data/account.bin saved automatically',
    sessionRestoredToast: 'Account restored from data/account.bin without re-login',
    portableUpdateNotice: 'Zero Re-Login Updates (Portable & Installer)',

    syncQuotaBtn: 'Sync real remaining quota from Mozilla server',
    transportProtocolLabel: 'Tunnel Transport Protocol',
    protocolHttp2Connect: 'HTTP/2 CONNECT · Port 2499 (Recommended)',
    protocolHttp2Tls: 'HTTP/2 TLS · Port 443 (Stealth)',
    protocolMasqueQuic: 'MASQUE HTTP/3 QUIC · Low Latency',
    protocolAuto: 'Automatic Smart Fallback',
    splitTunnelTitle: 'Per-App Split Tunneling',
    splitModeAll: 'All Apps',
    splitModeInclude: 'Only Selected',
    splitModeExclude: 'Bypass Selected',
    splitTunnelDesc: 'Select Windows applications or add custom executable (.exe) names:',
    splitTunnelAppsPlaceholder: 'Process name (e.g. chrome.exe)',
    addAppBtn: 'Add',
    localPortsTitle: 'Local Proxy Ports & LAN Sharing',
    socksPortLabel: 'Local SOCKS5 Port',
    httpPortLabel: 'Local HTTP Port',
    allowLanLabel: 'Allow LAN Connections',
    allowLanDesc: 'Allow other devices on Wi-Fi/LAN to use this proxy',
    fragmentSizeLabel: 'Fragment Size (B)',
    fragmentDelayLabel: 'Fragment Delay (ms)',
    blockIpv6Label: 'Block IPv6 Leaks',
    blockIpv6Desc: 'Prevent direct IPv6 traffic from leaking outside the VPN tunnel',
    aboutSummary: 'Fast native Windows client for Mozilla 50 GB monthly free allowance across 38 Fastly nodes.',
    checkForUpdatesBtn: 'Check for New Version',
    checkingUpdates: 'Checking GitHub Releases...',
    updateAvailableTitle: 'New version available',
    upToDateNotice: 'You are on the latest version',
    downloadUpdateBtn: 'Download Update',
  },
};
