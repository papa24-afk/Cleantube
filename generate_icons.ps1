Add-Type -AssemblyName System.Drawing

function Create-AppIcon {
    param (
        [int]$size,
        [string]$outputPath
    )

    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)

    $padding = [float]($size * 0.05)
    $w = [float]($size - 2 * $padding)
    $h = [float]($size - 2 * $padding)

    # Base shield / rounded rectangle
    $rectPath = New-Object System.Drawing.Drawing2D.GraphicsPath
    $radius = [float]($size * 0.22)
    $rect = New-Object System.Drawing.RectangleF $padding, $padding, $w, $h

    $rectPath.AddArc($rect.X, $rect.Y, $radius * 2, $radius * 2, 180, 90)
    $rectPath.AddArc($rect.Right - 2 * $radius, $rect.Y, $radius * 2, $radius * 2, 270, 90)
    $rectPath.AddArc($rect.Right - 2 * $radius, $rect.Bottom - 2 * $radius, $radius * 2, $radius * 2, 0, 90)
    $rectPath.AddArc($rect.X, $rect.Bottom - 2 * $radius, $radius * 2, $radius * 2, 90, 90)
    $rectPath.CloseFigure()

    # Red YouTube gradient
    $ptStart = New-Object System.Drawing.PointF 0, 0
    $ptEnd = New-Object System.Drawing.PointF $size, $size
    $cTop = [System.Drawing.Color]::FromArgb(255, 255, 30, 45)
    $cBottom = [System.Drawing.Color]::FromArgb(255, 180, 10, 20)
    $gradBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $ptStart, $ptEnd, $cTop, $cBottom
    $g.FillPath($gradBrush, $rectPath)

    # Darker subtle inner border
    $borderPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(80, 0, 0, 0)), ([Math]::Max(1.0, [float]($size * 0.02)))
    $g.DrawPath($borderPen, $rectPath)

    # White play triangle
    $cx = [float]($size * 0.46)
    $cy = [float]($size * 0.50)
    $halfW = [float]($size * 0.16)
    $halfH = [float]($size * 0.20)

    $p1 = New-Object System.Drawing.PointF ($cx - $halfW), ($cy - $halfH)
    $p2 = New-Object System.Drawing.PointF ($cx + $halfW * 1.5), $cy
    $p3 = New-Object System.Drawing.PointF ($cx - $halfW), ($cy + $halfH)
    [System.Drawing.PointF[]]$points = @($p1, $p2, $p3)

    $whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    $g.FillPolygon($whiteBrush, $points)

    # Sleek blocker shield slash / badge in bottom right
    $slashPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 20, 20, 20)), ([Math]::Max(2.0, [float]($size * 0.11)))
    $slashPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $slashPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $slashStart = New-Object System.Drawing.PointF ([float]($size * 0.82)), ([float]($size * 0.18))
    $slashEnd = New-Object System.Drawing.PointF ([float]($size * 0.18)), ([float]($size * 0.82))
    $g.DrawLine($slashPen, $slashStart, $slashEnd)

    # Thin white highlight line inside slash for clarity
    $innerPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(230, 255, 255, 255)), ([Math]::Max(1.0, [float]($size * 0.04)))
    $innerPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $innerPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawLine($innerPen, $slashStart, $slashEnd)

    # Save
    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $borderPen.Dispose()
    $whiteBrush.Dispose()
    $slashPen.Dispose()
    $innerPen.Dispose()
    $gradBrush.Dispose()
    $rectPath.Dispose()
    $g.Dispose()
    $bmp.Dispose()
}

Create-AppIcon -size 16 -outputPath "icons/icon16.png"
Create-AppIcon -size 32 -outputPath "icons/icon32.png"
Create-AppIcon -size 48 -outputPath "icons/icon48.png"
Create-AppIcon -size 128 -outputPath "icons/icon128.png"
Write-Output "Generated 16, 32, 48, 128 PNG icons successfully."
