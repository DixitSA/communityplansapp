# Render silent, clearly disclosed typography-only Reel storyboards from launch-drafts.json.
# Requires an already installed ffmpeg build with libx264; installs nothing.
# Usage: powershell -ExecutionPolicy Bypass -File .\marketing\scripts\render-reel-storyboards.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repoRoot = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))
$contentPath = Join-Path $repoRoot 'marketing\content\launch-drafts.json'
$outputRoot = Join-Path $repoRoot 'marketing\reels'
$storyboardDir = Join-Path $outputRoot 'storyboards'
New-Item -ItemType Directory -Force $storyboardDir | Out-Null
$ffmpegCommand = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpegCommand) { throw 'ffmpeg is not installed or is not on PATH.' }
$ffmpeg = $ffmpegCommand.Source
$ffmpegInfo = (& $ffmpeg -encoders 2>&1 | Out-String)
if ($ffmpegInfo -notmatch 'libx264') { throw 'The installed ffmpeg build does not include libx264.' }

$cream = '#F6F3EC'
$forest = '#2E5B45'
$mint = '#7FC3A0'
$dark = '#101411'
$disclosure = 'CONCEPT STORYBOARD · TYPOGRAPHY ONLY'
$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg' | Select-Object -First 1
$jpegEncoderParameter = [System.Drawing.Imaging.EncoderParameter]::new([System.Drawing.Imaging.Encoder]::Quality, [long]94)
$jpegEncoderParameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
$jpegEncoderParameters.Param[0] = $jpegEncoderParameter

function Convert-HexColor([string] $Hex) { [System.Drawing.ColorTranslator]::FromHtml($Hex) }
function Format-Time([int] $Seconds) {
    $minutes = [math]::Floor($Seconds / 60)
    $remaining = $Seconds % 60
    return ('{0}:{1:d2}' -f $minutes, $remaining)
}
function Parse-Clock([string] $Clock) {
    $parts = $Clock.Trim().Split(':')
    return ([int]$parts[0] * 60 + [int]$parts[1])
}
function Parse-Segment([string] $Range) {
    if ($Range -notmatch '^\s*(\d+:\d{2})\s*[–—-]\s*(\d+:\d{2})\s*$') { throw "Cannot parse time range: $Range" }
    return @{ Start = (Parse-Clock $Matches[1]); End = (Parse-Clock $Matches[2]) }
}
function Draw-Text($Graphics, [string] $Text, [float] $X, [float] $Y, [float] $Width, [float] $Height, [float] $Size, [string] $Color, [bool] $Bold = $true) {
    $style = if ($Bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $font = [System.Drawing.Font]::new('Segoe UI', $Size, $style, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = [System.Drawing.SolidBrush]::new((Convert-HexColor $Color))
    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    try { $Graphics.DrawString($Text, $font, $brush, [System.Drawing.RectangleF]::new($X, $Y, $Width, $Height), $format) }
    finally { $format.Dispose(); $brush.Dispose(); $font.Dispose() }
}
function Draw-RoundedRect($Graphics, [int] $X, [int] $Y, [int] $Width, [int] $Height, [int] $Radius, [string] $Color) {
    $brush = [System.Drawing.SolidBrush]::new((Convert-HexColor $Color))
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    try {
        $diameter = $Radius * 2
        $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
        $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
        $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
        $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
        $path.CloseFigure()
        $Graphics.FillPath($brush, $path)
    }
    finally { $path.Dispose(); $brush.Dispose() }
}
function Render-Card([string] $Path, [object] $Reel, [object] $Scene, [int] $Index, [int] $Count, [bool] $IsCover) {
    $bitmap = [System.Drawing.Bitmap]::new(1080, 1920, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
        $bg = if (($Index % 2) -eq 0) { $cream } else { $forest }
        $ink = if (($Index % 2) -eq 0) { $forest } else { $cream }
        $graphics.Clear((Convert-HexColor $bg))
        $segment = Parse-Segment $Scene.time
        $start = Format-Time $segment.Start
        $end = Format-Time $segment.End
        Draw-Text $graphics 'yard.' 360 130 360 130 94 $ink $true
        Draw-Text $graphics $disclosure 105 280 870 64 28 $ink $true
        Draw-Text $graphics "$start  —  $end" 150 390 780 56 30 $ink $false
        Draw-RoundedRect $graphics 460 510 160 8 4 $mint
        $headline = [string]$Scene.onScreen
        $fontSize = if ($headline.Length -gt 48) { 55 } elseif ($headline.Length -gt 34) { 66 } elseif ($headline.Length -gt 22) { 76 } else { 90 }
        if ($headline.Length -gt 65) { $fontSize = 48 }
        Draw-Text $graphics $headline 125 650 830 600 $fontSize $ink $true
        Draw-RoundedRect $graphics 160 1380 760 4 2 $mint
        Draw-Text $graphics 'Illustrative type only · no app UI, people, or live events' 120 1425 840 110 28 $ink $false
        Draw-Text $graphics $Reel.title 130 1570 820 130 32 $ink $true
        Draw-Text $graphics ('{0} / {1}' -f ($Index + 1), $Count) 390 1780 300 64 26 $ink $false
        $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally { $graphics.Dispose(); $bitmap.Dispose() }
}

$draft = Get-Content -Raw $contentPath | ConvertFrom-Json
$manifest = [System.Collections.Generic.List[object]]::new()
foreach ($reel in $draft.reels) {
    $id = [string]$reel.id
    $scenes = @($reel.timestampedScript)
    if ($scenes.Count -lt 2) { throw "$id needs at least two storyboard scenes." }
    $sceneFiles = [System.Collections.Generic.List[string]]::new()
    $subtitle = [System.Collections.Generic.List[string]]::new()
    $storyboardScenes = [System.Collections.Generic.List[object]]::new()
    $totalDuration = [int]$reel.durationSeconds
    for ($i = 0; $i -lt $scenes.Count; $i++) {
        $scene = $scenes[$i]
        $timing = Parse-Segment ([string]$scene.time)
        if ($i -eq 0 -and $timing.Start -ne 0) { throw "$id must start at 0:00." }
        if ($i -gt 0) {
            $prior = Parse-Segment ([string]$scenes[$i - 1].time)
            if ($timing.Start -ne $prior.End) { throw "$id has a gap or overlap between script segments." }
        }
        $scenePath = Join-Path $storyboardDir ("{0}-scene-{1:d2}.png" -f $id, ($i + 1))
        Render-Card $scenePath $reel $scene $i $scenes.Count ($i -eq 0)
        $sceneFiles.Add($scenePath)
        $storyboardScenes.Add([ordered]@{
            time = [string]$scene.time
            onScreen = [string]$scene.onScreen
            draftVoiceoverCaption = [string]$scene.voiceover
            image = ("storyboards/{0}-scene-{1:d2}.png" -f $id, ($i + 1))
        })
        $begin = $timing.Start
        $finish = $timing.End
        $beginTime = '{0:00}:{1:00}:{2:00},000' -f [math]::Floor($begin / 3600), [math]::Floor(($begin % 3600) / 60), ($begin % 60)
        $finishTime = '{0:00}:{1:00}:{2:00},000' -f [math]::Floor($finish / 3600), [math]::Floor(($finish % 3600) / 60), ($finish % 60)
        $subtitle.Add([string]($i + 1))
        $subtitle.Add("$beginTime --> $finishTime")
        $subtitle.Add([string]$scene.voiceover)
        $subtitle.Add('')
    }
    $lastTiming = Parse-Segment ([string]$scenes[-1].time)
    if ($lastTiming.End -ne $totalDuration) { throw "$id timestamped script ends at $($lastTiming.End)s but duration is $($totalDuration)s." }

    $coverPath = Join-Path $outputRoot "$id-cover.jpg"
    $coverBitmap = [System.Drawing.Image]::FromFile($sceneFiles[0])
    try { $coverBitmap.Save($coverPath, $jpegCodec, $jpegEncoderParameters) } finally { $coverBitmap.Dispose() }
    $srtPath = Join-Path $outputRoot "$id.srt"
    [System.IO.File]::WriteAllLines($srtPath, $subtitle, [System.Text.UTF8Encoding]::new($false))

    $arguments = [System.Collections.Generic.List[string]]::new()
    foreach ($i in 0..($sceneFiles.Count - 1)) {
        $timing = Parse-Segment ([string]$scenes[$i].time)
        $length = $timing.End - $timing.Start
        if ($i -eq ($sceneFiles.Count - 1)) { $length += 0.9 }
        $arguments.Add('-loop'); $arguments.Add('1')
        $arguments.Add('-framerate'); $arguments.Add('30')
        $arguments.Add('-t'); $arguments.Add([string]$length)
        $arguments.Add('-i'); $arguments.Add($sceneFiles[$i])
    }
    $filters = [System.Collections.Generic.List[string]]::new()
    foreach ($i in 0..($sceneFiles.Count - 1)) {
        $filters.Add("[$i`:v]fps=30,scale=1120:1984,crop=1080:1920:x='(iw-ow)/2+8*sin(t)':y='(ih-oh)/2',setpts=PTS-STARTPTS,format=yuv420p[v$i]")
    }
    $inputs = (0..($sceneFiles.Count - 1) | ForEach-Object { "[v$_]" }) -join ''
    $filters.Add("${inputs}concat=n=$($sceneFiles.Count):v=1:a=0,trim=duration=$totalDuration,setpts=PTS-STARTPTS[outv]")
    $filterGraph = $filters -join ';'
    $videoPath = Join-Path $outputRoot "$id.mp4"
    $arguments.Add('-filter_complex'); $arguments.Add($filterGraph)
    $arguments.Add('-map'); $arguments.Add('[outv]')
    $arguments.Add('-t'); $arguments.Add([string]$totalDuration)
    $arguments.Add('-r'); $arguments.Add('30')
    $arguments.Add('-c:v'); $arguments.Add('libx264')
    $arguments.Add('-preset'); $arguments.Add('medium')
    $arguments.Add('-crf'); $arguments.Add('18')
    $arguments.Add('-pix_fmt'); $arguments.Add('yuv420p')
    $arguments.Add('-movflags'); $arguments.Add('+faststart')
    $arguments.Add('-an')
    $arguments.Add('-y'); $arguments.Add($videoPath)
    & $ffmpeg @($arguments.ToArray()) 2>&1 | Out-String | Write-Verbose
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $videoPath)) { throw "ffmpeg failed while rendering $id (exit $LASTEXITCODE)." }
    $manifest.Add([ordered]@{
        id = $id
        title = [string]$reel.title
        status = 'draft'
        format = 'silent typography-only concept storyboard'
        disclosure = $disclosure
        video = "$id.mp4"
        cover = "$id-cover.jpg"
        subtitles = "$id.srt"
        durationSeconds = $totalDuration
        dimensions = '1080x1920'
        frameRate = 30
        videoCodec = 'H.264 / libx264'
        audio = 'Silent; no music or recorded voiceover.'
        captionSidecarNote = 'SRT covers the full duration with draft voiceover text; the video itself is silent.'
        caption = [string]$reel.caption
        hashtags = @($reel.hashtags)
        cta = [string]$reel.cta
        scenes = @($storyboardScenes.ToArray())
    })
}
$manifestPath = Join-Path $outputRoot 'manifest.json'
$manifest | ConvertTo-Json -Depth 10 | Set-Content -Encoding utf8 $manifestPath
$jpegEncoderParameters.Dispose()
$jpegEncoderParameter.Dispose()
Write-Output "Rendered $($manifest.Count) silent H.264 storyboards and captions to $outputRoot"

