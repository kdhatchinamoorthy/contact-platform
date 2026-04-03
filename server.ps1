$port = 8080
$root = $PSScriptRoot
$url  = 'http://localhost:' + $port + '/'

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host '  ContactHub Intelligence Server' -ForegroundColor Cyan
Write-Host ('  URL: ' + $url) -ForegroundColor Yellow
Write-Host '  Press Ctrl+C to stop' -ForegroundColor Gray
Write-Host '========================================' -ForegroundColor Cyan

Start-Process $url

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)
$listener.Start()

Write-Host ('Server running at ' + $url) -ForegroundColor Green

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.css'  = 'text/css'
    '.js'   = 'application/javascript'
    '.json' = 'application/json'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.webp' = 'image/webp'
}

while ($listener.IsListening) {
    try {
        $ctx  = $listener.GetContext()
        $req  = $ctx.Request
        $resp = $ctx.Response

        $rawPath = $req.Url.LocalPath
        if ($rawPath -eq '/') { $rawPath = '/index.html' }

        $filePath = Join-Path $root ($rawPath.TrimStart('/').Replace('/', '\'))

        if (Test-Path $filePath -PathType Leaf) {
            $ext     = [System.IO.Path]::GetExtension($filePath).ToLower()
            $mime    = if ($mimeTypes[$ext]) { $mimeTypes[$ext] } else { 'application/octet-stream' }
            $content = [System.IO.File]::ReadAllBytes($filePath)
            $resp.ContentType     = $mime
            $resp.ContentLength64 = $content.Length
            $resp.StatusCode      = 200
            $resp.OutputStream.Write($content, 0, $content.Length)
        } else {
            $msg = [System.Text.Encoding]::UTF8.GetBytes('404 Not Found')
            $resp.StatusCode = 404
            $resp.OutputStream.Write($msg, 0, $msg.Length)
        }
        $resp.OutputStream.Close()
    } catch {
        if ($_.Exception.Message -notlike '*listener*') {
            Write-Warning ('Request error: ' + $_.Exception.Message)
        }
    }
}
