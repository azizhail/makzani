$port = 8080
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $port)
$listener.Start()
Write-Host "TCP Web Server running on port $port..."

$root = $PSScriptRoot

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $stream.ReadTimeout = 3000
            $stream.WriteTimeout = 3000
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
            $requestLine = $reader.ReadLine()

            if (![string]::IsNullOrWhiteSpace($requestLine)) {
                # Drain remaining headers
                while ($true) {
                    $line = $reader.ReadLine()
                    if ($null -eq $line -or $line.Trim() -eq "") { break }
                }

                $parts = $requestLine.Split(" ")
                $rawPath = if ($parts.Length -ge 2) { $parts[1] } else { "/" }
                $cleanPath = $rawPath.Split("?")[0]
                if ($cleanPath -eq "/" -or [string]::IsNullOrWhiteSpace($cleanPath)) {
                    $cleanPath = "/index.html"
                }

                $filePath = Join-Path $root ($cleanPath.TrimStart('/').Replace('/', '\'))

                if (Test-Path $filePath -PathType Leaf) {
                    $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                    $contentType = switch ($ext) {
                        ".html" { "text/html; charset=utf-8" }
                        ".css"  { "text/css; charset=utf-8" }
                        ".js"   { "application/javascript; charset=utf-8" }
                        ".json" { "application/json; charset=utf-8" }
                        ".svg"  { "image/svg+xml" }
                        ".png"  { "image/png" }
                        default { "application/octet-stream" }
                    }

                    $fileBytes = [System.IO.File]::ReadAllBytes($filePath)
                    $headerStr = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($fileBytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
                    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerStr)

                    $stream.Write($headerBytes, 0, $headerBytes.Length)
                    $stream.Write($fileBytes, 0, $fileBytes.Length)
                } else {
                    $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
                    $headerStr = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($msg.Length)`r`nConnection: close`r`n`r`n"
                    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerStr)

                    $stream.Write($headerBytes, 0, $headerBytes.Length)
                    $stream.Write($msg, 0, $msg.Length)
                }
                $stream.Flush()
            }
        } catch {
        } finally {
            $client.Close()
        }
    }
} finally {
    $listener.Stop()
}

