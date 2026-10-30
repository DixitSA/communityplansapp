param(
    [string]$DraftsPath = (Join-Path $PSScriptRoot '..\content\launch-drafts.json'),
    [string]$OutputDirectory = $PSScriptRoot
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$outRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$mediaDir = Join-Path $outRoot 'media'
New-Item -ItemType Directory -Force -Path $outRoot, $mediaDir | Out-Null
# Keep reruns aligned with the current source set without touching non-PNG files.
Get-ChildItem -LiteralPath $mediaDir -File -Filter '*.png' -ErrorAction SilentlyContinue | Remove-Item -Force
$data = Get-Content -LiteralPath $DraftsPath -Raw -Encoding UTF8 | ConvertFrom-Json

$colors = @{
    cream = '#F6F3EC'; white = '#FFFFFF'; muted = '#ECE8DF'; ink = '#16201A';
    secondary = '#5E665F'; line = '#E4E0D6'; forest = '#2E5B45'; accentSoft = '#DCE9E0';
    peach = '#F3BC9F'; peachSoft = '#FFF1E9'; mint = '#5E9C86'; mintSoft = '#D9EAE3';
    deep = '#352C48'
}

function Get-Color([string]$hex) {
    return [System.Drawing.ColorTranslator]::FromHtml($hex)
}

function New-Font([float]$size, [bool]$bold = $false) {
    $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    return [System.Drawing.Font]::new('Segoe UI', $size, $style, [System.Drawing.GraphicsUnit]::Pixel)
}

function New-Format([string]$alignment = 'Near') {
    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::$alignment
    $format.LineAlignment = [System.Drawing.StringAlignment]::Near
    $format.Trimming = [System.Drawing.StringTrimming]::Word
    $format.FormatFlags = [System.Drawing.StringFormatFlags]::LineLimit
    return $format
}

function Draw-Text($graphics, [string]$text, [string]$color, [float]$x, [float]$y, [float]$width, [float]$height, [float]$size, [bool]$bold = $false, [string]$alignment = 'Near') {
    if ([string]::IsNullOrWhiteSpace($text)) { return }
    $font = New-Font $size $bold
    $brush = [System.Drawing.SolidBrush]::new((Get-Color $color))
    $format = New-Format $alignment
    $rect = [System.Drawing.RectangleF]::new($x, $y, $width, $height)
    $graphics.DrawString($text, $font, $brush, $rect, $format)
    $format.Dispose(); $brush.Dispose(); $font.Dispose()
}

function Get-FitSize($graphics, [string]$text, [float]$maxWidth, [float]$maxHeight, [float]$startSize, [float]$minSize, [bool]$bold = $true) {
    $probeBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::Black)
    $format = New-Format
    for ($size = $startSize; $size -ge $minSize; $size -= 2) {
        $font = New-Font $size $bold
        $measured = $graphics.MeasureString($text, $font, [System.Drawing.SizeF]::new($maxWidth, $maxHeight), $format)
        $font.Dispose()
        if ($measured.Height -le $maxHeight -and $measured.Width -le ($maxWidth + 2)) {
            $format.Dispose(); $probeBrush.Dispose()
            return $size
        }
    }
    $format.Dispose(); $probeBrush.Dispose()
    return $minSize
}

function Draw-RoundedRect($graphics, [float]$x, [float]$y, [float]$width, [float]$height, [float]$radius, [string]$fill, [string]$stroke = '') {
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $d = $radius * 2
    $path.AddArc($x, $y, $d, $d, 180, 90)
    $path.AddArc($x + $width - $d, $y, $d, $d, 270, 90)
    $path.AddArc($x + $width - $d, $y + $height - $d, $d, $d, 0, 90)
    $path.AddArc($x, $y + $height - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    $brush = [System.Drawing.SolidBrush]::new((Get-Color $fill))
    $graphics.FillPath($brush, $path)
    if ($stroke) {
        $pen = [System.Drawing.Pen]::new((Get-Color $stroke), 3)
        $graphics.DrawPath($pen, $path)
        $pen.Dispose()
    }
    $brush.Dispose(); $path.Dispose()
}

function Draw-CalendarMotif($graphics, [int]$x, [int]$y, [string]$color, [string]$accent, [bool]$outline = $false) {
    $pen = [System.Drawing.Pen]::new((Get-Color $color), 4)
    if ($outline) { Draw-RoundedRect $graphics $x $y 142 130 18 $accent $color }
    else { Draw-RoundedRect $graphics $x $y 142 130 18 $accent }
    $graphics.DrawLine($pen, $x + 4, $y + 34, $x + 138, $y + 34)
    $graphics.DrawLine($pen, $x + 38, $y + 4, $x + 38, $y + 22)
    $graphics.DrawLine($pen, $x + 102, $y + 4, $x + 102, $y + 22)
    for ($row = 0; $row -lt 2; $row++) {
        for ($col = 0; $col -lt 4; $col++) {
            $cx = $x + 22 + ($col * 31); $cy = $y + 57 + ($row * 29)
            $fill = if (($row -eq 1) -and ($col -eq 2)) { [System.Drawing.SolidBrush]::new((Get-Color $color)) } else { [System.Drawing.SolidBrush]::new((Get-Color $accent)) }
            $graphics.FillEllipse($fill, $cx, $cy, 10, 10); $fill.Dispose()
        }
    }
    $pen.Dispose()
}

function Draw-Circle($graphics, [int]$x, [int]$y, [int]$diameter, [string]$fill) {
    $brush = [System.Drawing.SolidBrush]::new((Get-Color $fill))
    $graphics.FillEllipse($brush, $x, $y, $diameter, $diameter)
    $brush.Dispose()
}

function Write-Slide($post, [int]$postIndex, [int]$slideIndex, $slide) {
    $w = 1080; $h = 1350
    $bitmap = [System.Drawing.Bitmap]::new($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear((Get-Color $colors.cream))

    # Rotating editorial palette and composition keeps the series varied while staying in the Yard system.
    $style = ($postIndex * 2 + $slideIndex) % 5
    $bg = $colors.cream; $fg = $colors.ink; $accent = $colors.forest; $soft = $colors.mintSoft; $panel = ''
    switch ($style) {
        0 { $bg = $colors.cream; $fg = $colors.ink; $accent = $colors.forest; $soft = $colors.mintSoft }
        1 { $bg = $colors.forest; $fg = $colors.cream; $accent = $colors.peach; $soft = $colors.accentSoft }
        2 { $bg = $colors.mintSoft; $fg = $colors.forest; $accent = $colors.peach; $soft = $colors.cream }
        3 { $bg = $colors.peachSoft; $fg = $colors.ink; $accent = $colors.forest; $soft = $colors.peach }
        4 { $bg = $colors.cream; $fg = $colors.forest; $accent = $colors.mint; $soft = $colors.peachSoft }
    }
    $g.Clear((Get-Color $bg))

    # A simple calendar page motif, kept abstract so it never suggests a real event/date.
    if ($style -eq 1) {
        Draw-CalendarMotif $g 850 80 $bg $soft $false
        Draw-Circle $g 815 250 28 $accent
        Draw-RoundedRect $g 72 1160 936 5 2 $soft
    } else {
        Draw-CalendarMotif $g 850 76 $accent $soft $true
        Draw-Circle $g 805 238 26 $accent
        Draw-RoundedRect $g 72 1160 936 5 2 $colors.line
    }

    # Layout accents are deliberately oversized and low-detail, like a printed editorial cover.
    if ($style -eq 2) {
        Draw-RoundedRect $g 72 330 936 690 36 $colors.cream
        Draw-Circle $g 865 1032 120 $colors.peach
    } elseif ($style -eq 3) {
        Draw-RoundedRect $g 74 322 932 714 38 $colors.peach
        Draw-Circle $g 850 1025 92 $colors.forest
    } elseif ($style -eq 4) {
        Draw-RoundedRect $g 72 350 15 632 7 $accent
        Draw-Circle $g 865 1015 112 $soft
    } else {
        Draw-Circle $g 888 1000 95 $soft
    }

    Draw-Text $g 'yard.' $fg 72 64 300 90 66 $true
    Draw-Text $g 'CHARLOTTE · IN THE MAKING' $fg 410 96 390 40 19 $true 'Far'
    Draw-Text $g ($post.id.ToUpperInvariant() + '  /  ' + ('{0:00}' -f ($slideIndex + 1))) $fg 72 270 500 42 20 $true

    $textX = if ($style -eq 4) { 118 } else { 92 }
    $textW = if ($style -eq 2 -or $style -eq 3) { 810 } else { 850 }
    $headline = [string]$slide.headline
    $headlineSize = Get-FitSize $g $headline $textW 370 100 66 $true
    Draw-Text $g $headline $fg $textX 368 $textW 382 $headlineSize $true

    $body = [string]$slide.body
    $bodySize = Get-FitSize $g $body $textW 190 42 32 $false
    Draw-Text $g $body $fg $textX 790 $textW 204 $bodySize $false

    Draw-Text $g 'FIND YOUR PEOPLE.' $fg 72 1190 570 40 21 $true
    $slideLabel = 'YARD  ·  ' + ('{0:00}' -f ($slideIndex + 1)) + ' / ' + ('{0:00}' -f $post.slides.Count)
    Draw-Text $g $slideLabel $fg 698 1190 310 40 18 $true 'Far'
    for ($i = 0; $i -lt $post.slides.Count; $i++) {
        $dotColor = if ($i -eq $slideIndex) { $accent } else { $soft }
        Draw-Circle $g (72 + ($i * 26)) 1247 12 $dotColor
    }

    $path = Join-Path $mediaDir ($post.id + '-' + ('{0:00}' -f ($slideIndex + 1)) + '.png')
    $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $bitmap.Dispose()
}

foreach ($pIndex in 0..($data.posts.Count - 1)) {
    $post = $data.posts[$pIndex]
    for ($sIndex = 0; $sIndex -lt $post.slides.Count; $sIndex++) {
        Write-Slide $post $pIndex $sIndex $post.slides[$sIndex]
    }
}

# Produce a contact sheet for a fast local visual pass.
$thumbW = 216; $thumbH = 270; $gap = 22; $cols = 6
$slideCount = ($data.posts | ForEach-Object { $_.slides.Count } | Measure-Object -Sum).Sum
$rows = [int][Math]::Ceiling($slideCount / $cols)
$sheet = [System.Drawing.Bitmap]::new(($cols * ($thumbW + $gap) + $gap), ($rows * ($thumbH + $gap) + $gap), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$sg = [System.Drawing.Graphics]::FromImage($sheet); $sg.Clear((Get-Color $colors.muted)); $sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$position = 0
foreach ($post in $data.posts) {
    for ($i = 1; $i -le $post.slides.Count; $i++) {
        $file = Join-Path $mediaDir ($post.id + '-' + ('{0:00}' -f $i) + '.png')
        $img = [System.Drawing.Image]::FromFile($file)
        $x = $gap + (($position % $cols) * ($thumbW + $gap)); $y = $gap + ([Math]::Floor($position / $cols) * ($thumbH + $gap))
        $sg.DrawImage($img, $x, $y, $thumbW, $thumbH)
        $img.Dispose(); $position++
    }
}
$sheet.Save((Join-Path $mediaDir 'contact-sheet.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$sg.Dispose(); $sheet.Dispose()

$json = $data | ConvertTo-Json -Depth 50 -Compress
$jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
$jsonBase64 = [Convert]::ToBase64String($jsonBytes)
$html = @'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>yard. — Draft preview</title>
  <style>
    :root{--canvas:#F6F3EC;--surface:#fff;--muted:#ECE8DF;--ink:#16201A;--secondary:#5E665F;--line:#E4E0D6;--forest:#2E5B45;--soft:#DCE9E0;--peach:#F3BC9F;--mint:#D9EAE3;--shadow:0 8px 28px rgba(29,39,31,.07)}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .wrap{max-width:1240px;margin:auto;padding:32px 28px 72px}.mast{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding:2px 0 19px}.wordmark{font-size:38px;line-height:1;font-weight:850;letter-spacing:-2.2px;color:var(--forest)}.mastnote,.eyebrow{font-size:11px;font-weight:750;letter-spacing:.14em;text-transform:uppercase;color:var(--secondary)}.notice{margin:22px 0 0;border-radius:14px;background:var(--forest);color:var(--canvas);padding:12px 16px;font-size:13px;letter-spacing:.01em}.hero{padding:46px 0 32px;display:grid;grid-template-columns:1.4fr .6fr;gap:32px;align-items:end}.hero h1{font-size:clamp(42px,7vw,76px);line-height:.98;letter-spacing:-.06em;margin:13px 0 16px;max-width:760px}.hero p{color:var(--secondary);font-size:18px;max-width:650px;margin:0}.heroCard{background:var(--mint);border-radius:22px;padding:22px 24px;transform:rotate(1deg)}.heroCard strong{font-size:29px;letter-spacing:-.04em;display:block}.heroCard span{color:var(--forest);font-size:13px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:20px 0 52px}.stat{background:rgba(255,255,255,.65);border:1px solid var(--line);border-radius:14px;padding:15px 18px}.stat b{font-size:26px;letter-spacing:-.04em;display:block}.stat small{color:var(--secondary);text-transform:uppercase;letter-spacing:.08em;font-size:10px;font-weight:700}.sectionHead{display:flex;align-items:end;justify-content:space-between;gap:20px;margin:45px 0 20px}.sectionHead h2{margin:5px 0 0;font-size:34px;line-height:1.05;letter-spacing:-.045em}.sectionHead p{color:var(--secondary);margin:0;font-size:14px}.postGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.post{background:var(--surface);border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:var(--shadow)}.post>img{display:block;width:100%;aspect-ratio:4/5;object-fit:cover;background:var(--muted)}.postMeta{padding:16px 17px 8px}.tagrow{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.tag{font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:750;color:var(--forest);background:var(--soft);border-radius:999px;padding:5px 9px}.tag.muted{background:var(--muted);color:var(--secondary)}.post h3{font-size:22px;line-height:1.14;letter-spacing:-.035em;margin:11px 0 6px}.postMeta p{font-size:13px;color:var(--secondary);margin:0}.post details{border-top:1px solid var(--line);margin-top:14px}.post summary{cursor:pointer;list-style:none;padding:13px 17px;font-size:13px;font-weight:720;color:var(--forest)}.post summary::-webkit-details-marker{display:none}.post summary:after{content:'＋';float:right;font-size:16px}.post details[open] summary:after{content:'−'}.detail{padding:0 17px 18px}.slides{display:flex;gap:10px;overflow:auto;padding:4px 0 12px;scroll-snap-type:x mandatory}.slides img{width:min(72%,260px);height:auto;flex:0 0 auto;border-radius:9px;scroll-snap-align:start;border:1px solid var(--line)}.copyblock{border-top:1px solid var(--line);padding-top:13px;margin-top:8px}.copyblock h4{font-size:10px;letter-spacing:.11em;text-transform:uppercase;color:var(--secondary);margin:13px 0 5px}.copyblock p{margin:0 0 7px;white-space:pre-wrap;font-size:14px}.hashtags{color:var(--forest);font-size:13px;line-height:1.7}.reelGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.reel{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:20px;box-shadow:var(--shadow)}.reel h3{font-size:23px;letter-spacing:-.035em;margin:11px 0 2px}.reelTop{display:flex;justify-content:space-between;gap:10px;align-items:start}.duration{font-size:12px;font-weight:700;color:var(--secondary);white-space:nowrap;background:var(--muted);padding:6px 10px;border-radius:999px}.timeline{display:grid;gap:10px;margin:17px 0}.beat{display:grid;grid-template-columns:78px 1fr;gap:10px;border-left:2px solid var(--mint);padding:0 0 1px 12px}.time{font-size:11px;font-weight:750;color:var(--forest);font-variant-numeric:tabular-nums}.beat p{margin:0;font-size:13px}.onscreen{color:var(--secondary);font-size:12px;margin-top:3px}.shotlist{border-top:1px solid var(--line);padding-top:12px}.shotlist h4,.reel h4{font-size:10px;letter-spacing:.11em;text-transform:uppercase;color:var(--secondary);margin:12px 0 8px}.shot{display:grid;grid-template-columns:78px 1fr;gap:10px;margin:9px 0;font-size:12px}.shot p{margin:0}.calendar{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.day{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;min-height:148px}.dayHead{display:flex;justify-content:space-between;align-items:center}.dayNum{font-weight:800;font-size:19px;letter-spacing:-.04em}.kind{font-size:9px;letter-spacing:.1em;text-transform:uppercase;font-weight:800;border-radius:999px;padding:4px 7px;background:var(--soft);color:var(--forest)}.kind.story{background:#FFF1E9;color:#70442F}.kind.rest{background:var(--muted);color:var(--secondary)}.day h3{font-size:13px;line-height:1.3;margin:11px 0 5px}.day p{font-size:11px;line-height:1.45;color:var(--secondary);margin:0}.highlightGrid{display:flex;flex-wrap:wrap;gap:9px}.highlight{border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:8px 13px;font-size:12px}.highlight b{color:var(--forest);margin-right:6px}.foot{border-top:1px solid var(--line);margin-top:56px;padding-top:16px;display:flex;justify-content:space-between;color:var(--secondary);font-size:12px}.foot strong{color:var(--forest)}
    @media(max-width:900px){.postGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.calendar{grid-template-columns:repeat(3,minmax(0,1fr))}.hero{grid-template-columns:1fr}.heroCard{max-width:400px}.reelGrid{grid-template-columns:1fr}}
    @media(max-width:580px){.wrap{padding:22px 16px 50px}.mastnote{max-width:150px;text-align:right}.hero{padding-top:36px}.hero h1{font-size:48px}.stats{gap:7px}.stat{padding:12px}.stat b{font-size:22px}.stat small{font-size:9px}.postGrid{grid-template-columns:1fr}.post>img{aspect-ratio:4/5}.calendar{grid-template-columns:repeat(2,minmax(0,1fr))}.sectionHead{align-items:start;flex-direction:column}.foot{display:block}.foot span{display:block;margin:6px 0}}
  </style>
</head>
<body>
  <main class="wrap">
    <header class="mast"><div class="wordmark">yard.</div><div class="mastnote">Local draft review · Charlotte first</div></header>
    <div class="notice"><strong>Drafts — not approved.</strong> This is a local, static preview for review. Nothing here publishes or schedules content.</div>
    <section class="hero"><div><div class="eyebrow">Find your people.</div><h1>Make the next plan feel closer.</h1><p>A working look at Yard’s launch content. Carousels, reel scripts, and a relative 30-day calendar in one offline review file.</p></div><div class="heroCard"><strong id="profileName">yard.</strong><span id="profileBio"></span></div></section>
    <div class="stats"><div class="stat"><b id="postCount">—</b><small>Carousel drafts</small></div><div class="stat"><b id="reelCount">—</b><small>Reel scripts</small></div><div class="stat"><b id="calendarCount">—</b><small>Relative days</small></div></div>
    <section id="posts"><div class="sectionHead"><div><div class="eyebrow">01 · Social posts</div><h2>Carousels</h2></div><p>Open any draft to see every slide and its full caption.</p></div><div class="postGrid" id="postGrid"></div></section>
    <section id="reels"><div class="sectionHead"><div><div class="eyebrow">02 · Short-form video</div><h2>Reel scripts</h2></div><p>Voiceover, on-screen text, and shot list from the draft brief.</p></div><div class="reelGrid" id="reelGrid"></div></section>
    <section id="calendar"><div class="sectionHead"><div><div class="eyebrow">03 · Suggested cadence</div><h2>30-day calendar</h2></div><p>Relative days only; no calendar dates or publishing actions.</p></div><div class="calendar" id="calendarGrid"></div></section>
    <section id="highlights"><div class="sectionHead"><div><div class="eyebrow">04 · Profile setup</div><h2>Highlight ideas</h2></div><p>Draft labels and cover text supplied with the content.</p></div><div class="highlightGrid" id="highlightGrid"></div></section>
    <footer class="foot"><span><strong>yard.</strong> · Find your people.</span><span>Static local preview · Unapproved drafts · No publishing controls</span></footer>
  </main>
  <script>
    const raw = atob('__DATA__');
    const bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const media = id => 'media/' + encodeURIComponent(id);
    const content = new Map([...(data.posts || []), ...(data.reels || [])].map(item => [item.id, item]));
    document.getElementById('profileName').textContent = data.profile?.displayName || 'yard.';
    document.getElementById('profileBio').textContent = data.profile?.bio || '';
    document.getElementById('postCount').textContent = (data.posts || []).length;
    document.getElementById('reelCount').textContent = (data.reels || []).length;
    document.getElementById('calendarCount').textContent = (data.calendar || []).length;
    document.getElementById('postGrid').innerHTML = (data.posts || []).map(post => {
      const slideCount = (post.slides || []).length;
      const images = (post.slides || []).map((slide, i) => `<img loading="lazy" src="${media(`${post.id}-${String(i+1).padStart(2,'0')}.png`)}" alt="${esc(slide.headline)} — slide ${i+1}">`).join('');
      const tags = (post.hashtags || []).map(tag => esc(tag)).join(' ');
      return `<article class="post" id="${esc(post.id)}"><img loading="lazy" src="${media(`${post.id}-01.png`)}" alt="First slide: ${esc(post.slides?.[0]?.headline || post.title)}"><div class="postMeta"><div class="tagrow"><span class="tag">${esc(post.status || 'draft')}</span><span class="tag muted">${slideCount} slides</span>${post.pinnedCandidate ? '<span class="tag muted">Pin candidate</span>' : ''}</div><h3>${esc(post.title)}</h3><p>${esc(post.format || 'carousel')} · ${esc((post.platforms || []).join(' / '))}</p><details><summary>View full draft</summary><div class="detail"><div class="slides">${images}</div><div class="copyblock"><h4>Caption</h4><p>${esc(post.caption)}</p><h4>Hashtags</h4><div class="hashtags">${tags}</div><h4>Call to action</h4><p>${esc(post.cta)}</p></div></div></details></div></article>`;
    }).join('');
    document.getElementById('reelGrid').innerHTML = (data.reels || []).map(reel => {
      const beats = (reel.timestampedScript || []).map(beat => `<div class="beat"><span class="time">${esc(beat.time)}</span><div><p><strong>VO</strong> · ${esc(beat.voiceover)}</p><div class="onscreen">On screen · ${esc(beat.onScreen)}</div></div></div>`).join('');
      const shots = (reel.shotList || []).map(shot => `<div class="shot"><span class="time">${esc(shot.time)}</span><p>${esc(shot.shot)}</p></div>`).join('');
      const reelTags = (reel.hashtags || []).map(tag => esc(tag)).join(' ');
      const copy = (reel.caption || reel.cta || reelTags) ? `<div class="copyblock"><h4>Caption</h4><p>${esc(reel.caption)}</p><h4>Hashtags</h4><div class="hashtags">${reelTags}</div><h4>Call to action</h4><p>${esc(reel.cta)}</p></div>` : '';
      return `<article class="reel" id="${esc(reel.id)}"><div class="reelTop"><div class="tagrow"><span class="tag">${esc(reel.status || 'draft')}</span></div><span class="duration">${esc(reel.durationSeconds)} sec</span></div><h3>${esc(reel.title)}</h3><div class="timeline">${beats}</div><div class="shotlist"><h4>Shot list</h4>${shots}</div>${copy}</article>`;
    }).join('');
    const calendar = data.calendar || [];
    document.getElementById('calendarGrid').innerHTML = calendar.map(day => {
      const linked = day.contentId ? content.get(day.contentId) : null;
      const title = linked?.title || day.prompt || (day.type === 'rest' ? 'Rest / replies' : 'Content idea');
      const detail = day.prompt && linked ? `${day.prompt} · ${day.note || ''}` : (day.note || (linked ? '' : day.prompt || ''));
      const kindClass = day.type === 'story' ? 'story' : day.type === 'rest' ? 'rest' : '';
      const link = linked ? `<a href="#${esc(day.contentId)}" style="color:inherit;text-decoration:none">${esc(title)} ↗</a>` : esc(title);
      return `<article class="day"><div class="dayHead"><span class="dayNum">Day ${esc(day.day)}</span><span class="kind ${kindClass}">${esc(day.type)}</span></div><h3>${link}</h3><p>${esc(detail)}</p></article>`;
    }).join('');
    document.getElementById('highlightGrid').innerHTML = (data.highlights || []).map(item => `<div class="highlight"><b>${esc(item.coverText)}</b>${esc(item.label)}</div>`).join('');
  </script>
</body>
</html>
'@
$html = $html.Replace('__DATA__', $jsonBase64)
Set-Content -LiteralPath (Join-Path $outRoot 'index.html') -Value $html -Encoding UTF8
Write-Output "Rendered $slideCount slides from $($data.posts.Count) posts; $($data.reels.Count) reels; $($data.calendar.Count) calendar days."
Write-Output "Preview: $(Join-Path $outRoot 'index.html')"
