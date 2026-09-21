param([switch]$Once,[switch]$VerboseConsole)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$ApiUrl='https://zodpkvssomalkxjzkpau.supabase.co/functions/v1/watan-nobde3-96-api'
$DataDir=Join-Path $env:LOCALAPPDATA 'Watan96SyncV2'
$StateFile=Join-Path $DataDir 'state.json'
$LogFile=Join-Path $DataDir 'sync.log'
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
function Log([string]$m){$l="$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $m";Add-Content $LogFile $l -Encoding UTF8;if($VerboseConsole){Write-Host $l}}
function OneDriveRoot{$c=@($env:OneDriveCommercial,$env:OneDrive,$env:OneDriveConsumer)|Where-Object{$_ -and (Test-Path $_)};if($c.Count){return $c[0]};foreach($rp in @('HKCU:\Software\Microsoft\OneDrive\Accounts\Business1','HKCU:\Software\Microsoft\OneDrive\Accounts\Business2','HKCU:\Software\Microsoft\OneDrive\Accounts\Personal')){try{$f=(Get-ItemProperty $rp -Name UserFolder -ErrorAction Stop).UserFolder;if($f -and (Test-Path $f)){return $f}}catch{}};return $null}
function LoadState{$h=@{};if(Test-Path $StateFile){try{$o=Get-Content $StateFile -Raw -Encoding UTF8|ConvertFrom-Json;foreach($p in $o.PSObject.Properties){$h[$p.Name]=$p.Value}}catch{}};return $h}
function SaveState($s){$s|ConvertTo-Json -Depth 6|Set-Content $StateFile -Encoding UTF8}
function Target([string]$root,[string]$rel){$p=$root;foreach($x in ($rel -split '/')){if($x){$p=Join-Path $p ($x -replace '[<>:"\\|?*]','-')}};return $p}
function GetItems{$r=Invoke-RestMethod -Uri $ApiUrl -Method Post -ContentType 'application/json' -Body '{"action":"list_public"}' -TimeoutSec 30;return @($r.items)}
function SyncNow{Log '=== بدء المزامنة v2 ===';try{$root=OneDriveRoot;if(-not $root){throw 'لم يتم العثور على مجلد OneDrive.'};Log "OneDrive: $root";$items=GetItems;Log "المشاركات المعتمدة: $($items.Count)";$state=LoadState;$new=0;$fail=0;foreach($i in $items){try{if(-not $i.id -or -not $i.file_url -or -not $i.one_drive_path){continue};$t=Target $root ([string]$i.one_drive_path);New-Item -ItemType Directory -Force -Path (Split-Path $t -Parent)|Out-Null;if((Test-Path $t)-and $state.ContainsKey([string]$i.id)){continue};$tmp="$t.download";Invoke-WebRequest -Uri ([string]$i.file_url) -OutFile $tmp -UseBasicParsing -TimeoutSec 120;Move-Item -Force $tmp $t;$state[[string]$i.id]=@{path=$t;syncedAt=(Get-Date).ToString('o')};SaveState $state;$new++;Log "تمت: $($i.student_name) - $($i.title)"}catch{$fail++;Log "فشل ملف: $($_.Exception.Message)"}};Log "النتيجة: جديد=$new | فشل=$fail"}catch{Log "خطأ عام: $($_.Exception.Message)"};Log '=== نهاية المزامنة ==='}
if($Once){SyncNow;exit}
$tray=New-Object System.Windows.Forms.NotifyIcon;$tray.Icon=[System.Drawing.SystemIcons]::Information;$tray.Text='وطن نبدع له 96 - OneDrive v2';$tray.Visible=$true
$menu=New-Object System.Windows.Forms.ContextMenuStrip
$m=$menu.Items.Add('مزامنة الآن');$m.add_Click({SyncNow})
$m=$menu.Items.Add('فتح سجل المزامنة');$m.add_Click({if(-not(Test-Path $LogFile)){New-Item $LogFile -ItemType File|Out-Null};Start-Process notepad.exe $LogFile})
$m=$menu.Items.Add('فتح مجلد المعرض');$m.add_Click({$r=OneDriveRoot;if($r){$g=Join-Path $r 'معرض اليوم الوطني 96';New-Item -ItemType Directory -Force -Path $g|Out-Null;Start-Process explorer.exe $g}})
$menu.Items.Add('-')|Out-Null
$m=$menu.Items.Add('خروج');$m.add_Click({$tray.Visible=$false;[System.Windows.Forms.Application]::Exit()})
$tray.ContextMenuStrip=$menu
$timer=New-Object System.Windows.Forms.Timer;$timer.Interval=60000;$timer.add_Tick({SyncNow});$timer.Start()
SyncNow
[System.Windows.Forms.Application]::Run()