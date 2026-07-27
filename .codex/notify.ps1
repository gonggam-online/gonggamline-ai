[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("approval", "complete")]
    [string]$Event
)

$ErrorActionPreference = "Stop"

$pattern = if ($Event -eq "approval") {
    @(
        @{ Frequency = 880; Duration = 180 },
        @{ Frequency = 660; Duration = 220 }
    )
} else {
    @(
        @{ Frequency = 660; Duration = 140 },
        @{ Frequency = 880; Duration = 140 },
        @{ Frequency = 1047; Duration = 260 }
    )
}

try {
    foreach ($tone in $pattern) {
        [Console]::Beep($tone.Frequency, $tone.Duration)
    }
    Write-Output "Codex notification played: $Event"
    exit 0
} catch {
    try {
        Add-Type -AssemblyName System.Windows.Forms
        if ($Event -eq "approval") {
            [System.Media.SystemSounds]::Exclamation.Play()
        } else {
            [System.Media.SystemSounds]::Asterisk.Play()
        }
        Write-Output "Codex notification fallback played: $Event"
        exit 0
    } catch {
        Write-Warning "Codex notification unavailable: $($_.Exception.Message)"
        exit 0
    }
}
