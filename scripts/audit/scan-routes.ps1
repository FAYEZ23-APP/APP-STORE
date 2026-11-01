# Helper script to scan all API routes, HTTP methods, and authorization
$controllers = Get-ChildItem -Path "backend/Marketplace.API/Controllers/*.cs"
$routeList = @()

foreach ($file in $controllers) {
    $lines = Get-Content $file.FullName
    $controllerName = $file.BaseName
    
    # Class-level route
    $classRoute = ""
    $classAuth = ""
    $classFeature = ""
    
    foreach ($line in $lines) {
        if ($line -match '\[Route\("([^"]+)"\)\]') {
            $classRoute = $matches[1]
        }
        if ($line -match '\[Authorize(\(([^)]+)\))?\]') {
            $classAuth = if ($matches[2]) { $matches[2] } else { "Authenticated" }
        }
        if ($line -match '\[RequireFeature\(([^)]+)\)\]') {
            $classFeature = $matches[1]
        }
        if ($line -match 'public class \w+Controller') {
            break
        }
    }
    
    # Scan action methods
    $currentVerbs = @()
    $currentRoute = ""
    $currentAuth = ""
    $currentFeature = ""
    $actionName = ""
    
    for ($i = 0; $i -lt $lines.Length; $i++) {
        $l = $lines[$i].Trim()
        
        if ($l -match '\[Http(Get|Post|Put|Delete|Patch)(\("([^"]*)"\))?\]') {
            $verb = $matches[1].ToUpper()
            $subRoute = if ($matches[3]) { $matches[3] } else { "" }
            $currentVerbs += @{ Verb = $verb; SubRoute = $subRoute; Line = ($i + 1) }
        }
        if ($l -match '\[Route\("([^"]+)"\)\]' -and $l -notmatch 'public class') {
            $currentRoute = $matches[1]
        }
        if ($l -match '\[Authorize(\(([^)]+)\))?\]' -and $l -notmatch 'public class') {
            $currentAuth = if ($matches[2]) { $matches[2] } else { "Authenticated" }
        }
        if ($l -match '\[AllowAnonymous\]') {
            $currentAuth = "AllowAnonymous"
        }
        if ($l -match '\[RequireFeature\(([^)]+)\)\]' -and $l -notmatch 'public class') {
            $currentFeature = $matches[1]
        }
        
        if ($l -match 'public\s+(async\s+)?Task<[^>]+>\s+(\w+)\(' -or $l -match 'public\s+(async\s+)?ActionResult<[^>]+>\s+(\w+)\(' -or $l -match 'public\s+(async\s+)?IActionResult\s+(\w+)\(') {
            $actionName = if ($matches[2]) { $matches[2] } else { $matches[1] }
            
            if ($currentVerbs.Count -gt 0) {
                foreach ($cv in $currentVerbs) {
                    $fullRoute = $classRoute
                    $sub = if ($cv.SubRoute) { $cv.SubRoute } elseif ($currentRoute) { $currentRoute } else { "" }
                    if ($sub) {
                        if ($sub.StartsWith("/")) {
                            $fullRoute = $sub.TrimStart('/')
                        } else {
                            $fullRoute = "$classRoute/$sub"
                        }
                    }
                    
                    $effectiveAuth = if ($currentAuth) { $currentAuth } elseif ($classAuth) { $classAuth } else { "None (Public)" }
                    $effectiveFeature = if ($currentFeature) { $currentFeature } elseif ($classFeature) { $classFeature } else { "None" }
                    
                    $routeList += [PSCustomObject]@{
                        Controller = $controllerName
                        Action = $actionName
                        Method = $cv.Verb
                        Route = "/$($fullRoute.Trim('/'))"
                        Auth = $effectiveAuth
                        Feature = $effectiveFeature
                        Source = "$($file.Name):$($cv.Line)"
                    }
                }
            }
            $currentVerbs = @()
            $currentRoute = ""
            $currentAuth = ""
            $currentFeature = ""
            $actionName = ""
        }
    }
}

$routeList | Format-Table -AutoSize
$routeList | Export-Csv -Path "docs/audit/routes.csv" -NoTypeInformation -Encoding utf8
