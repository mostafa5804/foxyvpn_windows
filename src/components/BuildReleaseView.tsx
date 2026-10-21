import React, { useState } from 'react';
import {
  FileCode2,
  GitBranch,
  Copy,
  Check,
  Terminal,
  PackageCheck,
} from 'lucide-react';

interface BuildReleaseViewProps {
  isDark: boolean;
}

const WORKFLOW_YAML = `name: Build FoxyVPN Windows Client

on:
  push:
    branches: [ main, master ]
    tags:
      - 'v*'
      - 'V*'
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-windows:
    name: Build Windows amd64 (.exe + Wintun)
    runs-on: windows-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Go 1.23
        uses: actions/setup-go@v5
        with:
          go-version: '1.23'
          cache: false

      - name: Set up Node.js 22 (No Lockfile Required)
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Normalize package.json for Public NPM Registry
        shell: pwsh
        run: |
          $pkg = @{
            name = "foxyvpn-windows"
            private = $true
            version = "1.2.0"
            type = "module"
            scripts = @{
              dev = "vite --port=3000 --host=0.0.0.0"
              build = "vite build"
              preview = "vite preview"
            }
            dependencies = @{
              "@tailwindcss/vite" = "^4.0.9"
              "@vitejs/plugin-react" = "^4.3.4"
              "lucide-react" = "^0.475.0"
              "react" = "^19.0.0"
              "react-dom" = "^19.0.0"
              "tailwindcss" = "^4.0.9"
              "vite" = "^6.2.0"
            }
            devDependencies = @{
              "@types/node" = "^22.13.0"
              "@types/react" = "^19.0.0"
              "@types/react-dom" = "^19.0.0"
              "typescript" = "^5.8.2"
            }
          }
          $pkg | ConvertTo-Json -Depth 5 | Set-Content -Path "package.json" -Encoding UTF8

      - name: Install Frontend Dependencies
        run: npm install --no-audit --no-fund

      - name: Run Logic Unit Tests
        run: node --test src/utils/vpnLogic.test.ts

      - name: Build Frontend Assets (dist/)
        run: npm run build

      - name: Install Wails v2 CLI
        run: go install github.com/wailsapp/wails/v2/cmd/wails@v2.9.2

      - name: Prepare Windows Manifest & App Icon
        shell: pwsh
        run: |
          New-Item -ItemType Directory -Force -Path "build/windows" | Out-Null
          Copy-Item -Force "manifest.xml" "build/windows/wails.exe.manifest"

      - name: Resolve Go Modules & Build FoxyVPN Windows Executable
        shell: pwsh
        run: |
          go mod tidy
          wails build -platform windows/amd64 -clean -s -o FoxyVPN.exe

      - name: Download Official Wintun v0.14.1 Driver (amd64)
        shell: pwsh
        run: |
          $wintunUrl = "https://www.wintun.net/builds/wintun-0.14.1.zip"
          $zipPath = "$env:TEMP\\wintun.zip"
          $extractPath = "$env:TEMP\\wintun_extracted"
          Invoke-WebRequest -Uri $wintunUrl -OutFile $zipPath -UseBasicParsing
          Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
          Copy-Item -Force "$extractPath\\wintun\\bin\\amd64\\wintun.dll" "build\\bin\\wintun.dll"

      - name: Package Portable Release ZIP
        shell: pwsh
        run: |
          New-Item -ItemType Directory -Force -Path "release" | Out-Null
          Copy-Item -Force "README.md" "build\\bin\\README.md"
          Compress-Archive -Path "build\\bin\\*" -DestinationPath "release\\FoxyVPN-Windows-amd64.zip" -Force

      - name: Upload Windows Build Artifact
        uses: actions/upload-artifact@v4
        with:
          name: FoxyVPN-Windows-amd64
          path: |
            release/FoxyVPN-Windows-amd64.zip
            build/bin/FoxyVPN.exe
            build/bin/wintun.dll

      - name: Publish GitHub Release (on Tag v* or V*)
        if: startsWith(github.ref, 'refs/tags/v') || startsWith(github.ref, 'refs/tags/V')
        uses: softprops/action-gh-release@v2
        with:
          files: |
            release/FoxyVPN-Windows-amd64.zip
          generate_release_notes: true`;

const GIT_COMMANDS = `git add .
git commit -m "fix(ci): remove npm lockfile cache error & support v/V release tags"
git push origin main

# Trigger automatic build & GitHub Release with v* or V* tag:
git tag v1.0.0
git push origin v1.0.0`;

export const BuildReleaseView: React.FC<BuildReleaseViewProps> = ({ isDark }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyText = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deliverables = [
    { path: 'go.mod', desc: 'Go 1.23 module with Wails v2, golang.org/x/net/http2, and golang.zx2c4.com/wintun' },
    { path: 'pkg/auth/guardian.go', desc: 'FxA Login, In-App Registration (/account/create), Hawk OTP verifier, Fastly 406 PoW solver, Guardian 50GB FPN API' },
    { path: 'pkg/vpn/tunnel.go', desc: 'HTTP/2 CONNECT multiplexed tunnel, TLS SNI ClientHello splitter, DoH DNS resolver, SOCKS5 & HTTP listeners, Exit IP verifier' },
    { path: 'pkg/vpn/wintun_windows.go', desc: 'Native Windows Wintun adapter (10.0.0.2/24), split routing table, UDP/53 DNS interception, and WinINET registry proxy' },
    { path: 'app.go & main.go', desc: 'Wails v2 typed frontend bindings, 50% lifetime ProxyPass auto-renewal loop, and UAC safe shutdown handler' },
    { path: 'manifest.xml & wails.json', desc: 'Windows UAC requireAdministrator manifest and Wails v2 desktop bundler config' },
    { path: '.github/workflows/build-windows.yml', desc: 'Automated GitHub Actions CI supporting v* and V* tags without lockfile errors' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight">
          GitHub Actions Automated Windows Build & Source Architecture
        </h2>
        <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
          All Go backend packages, Wintun native bindings, UAC manifest, and CI/CD workflows are generated in the project root
        </p>
      </div>

      {/* Deliverable Files Inventory */}
      <div
        className={`rounded-2xl border p-5 space-y-3 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2 text-sm font-semibold">
          <PackageCheck className="w-4 h-4 text-emerald-400" />
          <span>Repository Files Ready for GitHub Actions</span>
        </div>

        <div className="divide-y divide-slate-800/50">
          {deliverables.map((item) => (
            <div key={item.path} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <code className="font-mono font-semibold text-orange-400 shrink-0">{item.path}</code>
              <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Git Push & Release Trigger Commands */}
      <div
        className={`rounded-2xl border p-5 space-y-3 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Terminal className="w-4 h-4 text-orange-400" />
            <span>Push to GitHub & Trigger Automatic .EXE Release (v* / V*)</span>
          </div>
          <button
            type="button"
            onClick={() => copyText('git', GIT_COMMANDS)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 cursor-pointer"
          >
            {copiedId === 'git' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedId === 'git' ? 'Copied' : 'Copy Commands'}</span>
          </button>
        </div>

        <pre
          className={`p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed ${
            isDark ? 'bg-slate-950 text-slate-200 border border-slate-800' : 'bg-slate-900 text-slate-100'
          }`}
        >
          {GIT_COMMANDS}
        </pre>
      </div>

      {/* GitHub Actions Workflow YAML Viewer */}
      <div
        className={`rounded-2xl border p-5 space-y-3 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <GitBranch className="w-4 h-4 text-orange-400" />
            <span>.github/workflows/build-windows.yml</span>
          </div>
          <button
            type="button"
            onClick={() => copyText('yaml', WORKFLOW_YAML)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 cursor-pointer"
          >
            {copiedId === 'yaml' ? <Check className="w-3.5 h-3.5" /> : <FileCode2 className="w-3.5 h-3.5" />}
            <span>{copiedId === 'yaml' ? 'Copied Workflow' : 'Copy YAML'}</span>
          </button>
        </div>

        <pre
          className={`p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-80 leading-relaxed ${
            isDark ? 'bg-slate-950 text-slate-300 border border-slate-800' : 'bg-slate-900 text-slate-100'
          }`}
        >
          {WORKFLOW_YAML}
        </pre>
      </div>
    </div>
  );
};
