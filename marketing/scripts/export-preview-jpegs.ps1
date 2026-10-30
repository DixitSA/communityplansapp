# Export the 36 feed slide PNGs as high-quality JPEGs, leaving all source PNGs intact.
# Usage: powershell -ExecutionPolicy Bypass -File .\marketing\scripts\export-preview-jpegs.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$sourceDir = Join-Path $repoRoot 'marketing\preview\media'
$outputDir = Join-Path $sourceDir 'jpeg'
New-Item -ItemType Directory -Force $outputDir | Out-Null
$files = @(Get-ChildItem $sourceDir -Filter 'feed-*.png' -File | Sort-Object Name)
if ($files.Count -ne 36) { throw "Expected 36 feed slide PNGs; found $($files.Count)." }
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg' | Select-Object -First 1
if (-not $codec) { throw 'Windows JPEG encoder is unavailable.' }
$qualityParam = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]95)
$params = [System.Drawing.Imaging.EncoderParameters]::new(1)
$params.Param[0] = $qualityParam
try {
    foreach ($file in $files) {
        $image = [System.Drawing.Image]::FromFile($file.FullName)
        try {
            if ($image.Width -ne 1080 -or $image.Height -ne 1350) { throw "Unexpected dimensions for $($file.Name): $($image.Width)x$($image.Height)." }
            $output = Join-Path $outputDir ([IO.Path]::GetFileNameWithoutExtension($file.Name) + '.jpg')
            $image.Save($output, $codec, $params)
        }
        finally { $image.Dispose() }
    }
}
finally { $params.Dispose(); $qualityParam.Dispose() }
Write-Output "Exported $($files.Count) JPEGs at 95 quality to $outputDir"

