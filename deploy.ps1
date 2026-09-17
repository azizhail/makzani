$zipPath = Join-Path $env:TEMP 'sales-manager-deploy.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path index.html, styles.css, app.js -DestinationPath $zipPath

try {
    $bytes = [System.IO.File]::ReadAllBytes($zipPath)
    $req = [System.Net.HttpWebRequest]::Create('https://api.netlify.com/api/v1/sites')
    $req.Method = 'POST'
    $req.ContentType = 'application/zip'
    $req.ContentLength = $bytes.Length
    $stream = $req.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
    $res = $req.GetResponse()
    $reader = New-Object System.IO.StreamReader($res.GetResponseStream())
    $json = $reader.ReadToEnd() | ConvertFrom-Json
    Write-Host "DEPLOY_SUCCESS_URL:$($json.ssl_url)"
} catch {
    Write-Host "DEPLOY_ERROR:$($_.Exception.Message)"
}
