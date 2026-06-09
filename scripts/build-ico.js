const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const srcPng = path.join(__dirname, "../public/icon.png");
const destIcoPublic = path.join(__dirname, "../public/icon.ico");
const destIcoBuild = path.join(__dirname, "../build/icon.ico");

const sizes = [16, 24, 32, 48, 64, 128, 256];

console.log("🚀 Starting Multi-Resolution ICO Generation...");
console.log(`   Source: ${srcPng}`);

// Ensure build directory exists
const buildDir = path.dirname(destIcoBuild);
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

// 1. Generate resized PNGs using PowerShell GDI+
console.log("⚙️  Resizing icons via PowerShell...");
const psScript = `
Add-Type -AssemblyName System.Drawing
$srcPath = "${srcPng.replace(/\\/g, "\\\\")}"
$src = [System.Drawing.Image]::FromFile($srcPath)
$sizes = @(${sizes.join(", ")})

foreach ($size in $sizes) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    
    # Draw image with high-quality smoothing
    $g.DrawImage($src, 0, 0, $size, $size)
    $g.Dispose()
    
    $destPath = Join-Path $env:TEMP "temp_icon_$size.png"
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}
$src.Dispose()
`;

const psScriptFile = path.join(__dirname, "temp_resize.ps1");
try {
  fs.writeFileSync(psScriptFile, psScript, "utf-8");
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptFile}"`, { stdio: "inherit" });
  console.log("✓ Resized PNG files generated in TEMP folder.");
} catch (err) {
  console.error("❌ PowerShell resize failed:", err);
  process.exit(1);
} finally {
  try {
    if (fs.existsSync(psScriptFile)) {
      fs.unlinkSync(psScriptFile);
    }
  } catch (e) {
    // ignore
  }
}

// 2. Read temp PNG files and pack them into ICO structure
console.log("📦 Packing PNG files into ICO container...");
const pngBuffers = [];
const tempPaths = [];

try {
  const tempDir = process.env.TEMP || process.env.TMP || "C:\\Windows\\Temp";
  
  for (const size of sizes) {
    const tempPath = path.join(tempDir, `temp_icon_${size}.png`);
    tempPaths.push(tempPath);
    if (!fs.existsSync(tempPath)) {
      throw new Error(`Resized file not found: ${tempPath}`);
    }
    pngBuffers.push(fs.readFileSync(tempPath));
  }

  // ICO Packing Logic
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = count * dirEntrySize;
  const totalHeaderSize = headerSize + dirSize;

  // Header: 6 bytes
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type (1 = icon)
  header.writeUInt16LE(count, 4); // Count of images

  const directoryEntries = [];
  let currentOffset = totalHeaderSize;

  for (let i = 0; i < count; i++) {
    const buf = pngBuffers[i];
    const size = sizes[i];
    const width = size === 256 ? 0 : size;
    const height = size === 256 ? 0 : size;

    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(width, 0); // Width
    entry.writeUInt8(height, 1); // Height
    entry.writeUInt8(0, 2); // Colors (0 = no palette)
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Planes (1)
    entry.writeUInt16LE(32, 6); // BPP (32)
    entry.writeUInt32LE(buf.length, 8); // Image size in bytes
    entry.writeUInt32LE(currentOffset, 12); // Image offset

    directoryEntries.push(entry);
    currentOffset += buf.length;
  }

  const icoBuffer = Buffer.concat([header, ...directoryEntries, ...pngBuffers]);

  // Write files
  fs.writeFileSync(destIcoPublic, icoBuffer);
  console.log(`✓ Icon written to ${destIcoPublic} (${(icoBuffer.length / 1024).toFixed(1)} KB)`);

  fs.writeFileSync(destIcoBuild, icoBuffer);
  console.log(`✓ Icon written to ${destIcoBuild} (${(icoBuffer.length / 1024).toFixed(1)} KB)`);

} catch (err) {
  console.error("❌ ICO packing failed:", err);
} finally {
  // 3. Clean up temp files
  console.log("🧹 Cleaning up temporary files...");
  for (const tempPath of tempPaths) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (e) {
      // ignore
    }
  }
  console.log("✅ Complete!");
}
