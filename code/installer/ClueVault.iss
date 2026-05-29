#define MyAppName "ClueVault"
#define MyAppVersion "0.2.4"
#define MyAppPublisher "EasyBIM"
#define MyAppExeName "ClueVault.Desktop.exe"
#define PublishDir "..\..\dist\ClueVault-v0.2.4-win-x64"

[Setup]
AppId={{8C89D363-616A-43F5-9D55-8A04F92D09B8}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\Programs\ClueVault
DefaultGroupName=ClueVault
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\..\dist
OutputBaseFilename=ClueVault-v{#MyAppVersion}-setup-win-x64
Compression=lzma
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\ClueVault.Desktop\Assets\app-icon.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
CloseApplications=yes
CloseApplicationsFilter=ClueVault.Desktop.exe

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加任务："; Flags: checkedonce

[Files]
Source: "{#PublishDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\ClueVault"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{userdesktop}\ClueVault"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "启动 ClueVault"; Flags: nowait postinstall skipifsilent
