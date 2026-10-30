# Render yard marketing brand assets with the Windows system font stack.
# Usage: powershell -ExecutionPolicy Bypass -File .\marketing\scripts\render-yard-brand.ps1

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$brandDir = Join-Path (Split-Path -Parent $scriptRoot) 'brand'
New-Item -ItemType Directory -Force $brandDir | Out-Null

$cream = '#F6F3EC'
$forest = '#2E5B45'
$dark = '#101411'
$mint = '#7FC3A0'

function To-Color([string] $Hex) {
    return [System.Drawing.ColorTranslator]::FromHtml($Hex)
}

function Save-Png([string] $Name, [int] $Width, [int] $Height, [string] $Background, [scriptblock] $Paint) {
    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
        if ($Background) { $graphics.Clear((To-Color $Background)) } else { $graphics.Clear([System.Drawing.Color]::Transparent) }
        & $Paint $graphics
        $bitmap.Save((Join-Path $brandDir $Name), [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

function Draw-CenteredText($Graphics, [string] $Text, [float] $X, [float] $Y, [float] $Width, [float] $Height, [float] $Size, [string] $Color, [bool] $Bold = $true) {
    $style = if ($Bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $font = [System.Drawing.Font]::new('Segoe UI', $Size, $style, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = [System.Drawing.SolidBrush]::new((To-Color $Color))
    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    try { $Graphics.DrawString($Text, $font, $brush, [System.Drawing.RectangleF]::new($X, $Y, $Width, $Height), $format) }
    finally { $format.Dispose(); $brush.Dispose(); $font.Dispose() }
}

function Svg-Text([string] $Text, [int] $X, [int] $Y, [int] $Size, [string] $Color, [bool] $Bold = $true, [string] $Extra = '') {
    $safe = [System.Security.SecurityElement]::Escape($Text)
    $weight = if ($Bold) { '700' } else { '400' }
    return "<text x=`"$X`" y=`"$Y`" text-anchor=`"middle`" fill=`"$Color`" font-family=`"Segoe UI, Arial, sans-serif`" font-size=`"$Size`" font-weight=`"$weight`" $Extra>$safe</text>"
}

function Write-Svg([string] $Name, [int] $Width, [int] $Height, [string] $Body) {
    $svg = "<svg xmlns=`"http://www.w3.org/2000/svg`" width=`"$Width`" height=`"$Height`" viewBox=`"0 0 $Width $Height`">`n$Body`n</svg>`n"
    [System.IO.File]::WriteAllText((Join-Path $brandDir $Name), $svg, [System.Text.UTF8Encoding]::new($false))
}

# Standalone wordmark: typography only, matching the lowercase treatment in the app mockup.
$wordmarkSvg = "<svg xmlns=`"http://www.w3.org/2000/svg`" width=`"960`" height=`"320`" viewBox=`"0 0 960 320`">`n" + (Svg-Text 'yard.' 480 237 224 $forest) + "`n</svg>`n"
[System.IO.File]::WriteAllText((Join-Path $brandDir 'yard-wordmark.svg'), $wordmarkSvg, [System.Text.UTF8Encoding]::new($false))
Save-Png 'yard-wordmark.png' 960 320 $null { param($g) Draw-CenteredText $g 'yard.' 0 12 960 276 218 $forest $true }

# Profile avatar, designed to read within a circular crop.
$avatarBody = "<rect width=`"1080`" height=`"1080`" fill=`"$forest`"/>`n" + (Svg-Text 'yard.' 540 610 250 $cream $true 'letter-spacing="-12"')
Write-Svg 'yard-avatar.svg' 1080 1080 $avatarBody
Save-Png 'yard-avatar.png' 1080 1080 $forest { param($g) Draw-CenteredText $g 'yard.' 32 375 1016 300 244 $cream $true }

# Facebook cover; all text sits in the centered safe area to survive edge cropping.
$coverBody = "<rect width=`"1640`" height=`"624`" fill=`"$forest`"/>`n" +
    (Svg-Text 'yard.' 820 192 112 $cream $true 'letter-spacing="-5"') + "`n" +
    (Svg-Text 'Find your people.' 820 285 66 $cream $true) + "`n" +
    '<rect x="785" y="354" width="70" height="5" rx="2.5" fill="' + $mint + '"/>' + "`n" +
    (Svg-Text "Charlotte, we're building something social." 820 422 36 $cream $false)
Write-Svg 'yard-facebook-cover.svg' 1640 624 $coverBody
Save-Png 'yard-facebook-cover.png' 1640 624 $forest {
    param($g)
    Draw-CenteredText $g 'yard.' 160 62 1320 145 110 $cream $true
    Draw-CenteredText $g 'Find your people.' 160 213 1320 86 66 $cream $true
    $ruleBrush = [System.Drawing.SolidBrush]::new((To-Color $mint))
    try { $g.FillRectangle($ruleBrush, 785, 355, 70, 5) } finally { $ruleBrush.Dispose() }
    Draw-CenteredText $g "Charlotte, we're building something social." 160 383 1320 70 36 $cream $false
}

# Matching circular highlight art, with the label centered well inside a circle crop.
$highlightLabels = @('Start here', 'Charlotte', 'Plans', 'People', 'Building')
foreach ($label in $highlightLabels) {
    $slug = $label.ToLowerInvariant() -replace '\s+', '-'
    $safe = [System.Security.SecurityElement]::Escape($label)
    $svgSize = if ($label.Length -gt 9) { 82 } else { 90 }
    $body = "<rect width=`"1080`" height=`"1080`" fill=`"$cream`"/>`n<rect x=`"495`" y=`"401`" width=`"90`" height=`"8`" rx=`"4`" fill=`"$mint`"/>`n" + (Svg-Text $label 540 579 $svgSize $forest $true)
    Write-Svg "yard-highlight-$slug.svg" 1080 1080 $body
    Save-Png "yard-highlight-$slug.png" 1080 1080 $cream {
        param($g)
        $ruleBrush = [System.Drawing.SolidBrush]::new((To-Color $mint))
        try { $g.FillRectangle($ruleBrush, 495, 401, 90, 8) } finally { $ruleBrush.Dispose() }
        $fontSize = if ($label.Length -gt 9) { 82 } else { 90 }
        Draw-CenteredText $g $label 80 454 920 188 $fontSize $forest $true
    }
}

Write-Output "Rendered yard brand assets to $brandDir"






