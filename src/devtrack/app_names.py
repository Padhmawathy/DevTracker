from pathlib import PurePath
APP_NAMES = {
    "code.exe": "Visual Studio Code",
    "cursor.exe": "Cursor",
    "devenv.exe": "Visual Studio",
    "pycharm64.exe": "PyCharm",
    "idea64.exe": "IntelliJ IDEA",
    "webstorm64.exe": "WebStorm",
    "windowsterminal.exe": "Windows Terminal",
    "powershell.exe": "Windows PowerShell",
    "pwsh.exe": "PowerShell",
    "cmd.exe": "Command Prompt",
    "python.exe": "Python",
    "pythonw.exe": "Python",
    "git-bash.exe": "Git Bash",
    "docker desktop.exe": "Docker Desktop",
    "chrome.exe": "Google Chrome",
    "msedge.exe": "Microsoft Edge",
    "firefox.exe": "Mozilla Firefox",
    "brave.exe": "Brave Browser",
    "opera.exe": "Opera",
    "discord.exe": "Discord",
    "teams.exe": "Microsoft Teams",
    "outlook.exe": "Microsoft Outlook",
    "whatsapp.exe": "WhatsApp",
    "telegram.exe": "Telegram Desktop",
    "zoom.exe": "Zoom Workplace",
    "slack.exe": "Slack",
    "photoshop.exe": "Adobe Photoshop",
    "illustrator.exe": "Adobe Illustrator",
    "afterfx.exe": "Adobe After Effects",
    "adobe premiere pro.exe": "Adobe Premiere Pro",
    "resolve.exe": "DaVinci Resolve",
    "blender.exe": "Blender",
    "figma.exe": "Figma",
    "winword.exe": "Microsoft Word",
    "excel.exe": "Microsoft Excel",
    "powerpnt.exe": "Microsoft PowerPoint",
    "onenote.exe": "Microsoft OneNote",
    "notion.exe": "Notion",
    "obsidian.exe": "Obsidian",
    "explorer.exe": "File Explorer",
    "notepad.exe": "Notepad",
    "taskmgr.exe": "Task Manager",
    "mspaint.exe": "Microsoft Paint",
    "calc.exe": "Calculator",
    "snippingtool.exe": "Snipping Tool",
    "searchhost.exe": "Windows Search",
}
def resolve_app_name(process_name: str) -> str:
    raw = (process_name or "").strip()
    if not raw:
        return "Unknown Application"
    executable = raw.replace("\\", "/").split("/")[-1]
    key = executable.casefold()
    if key == "applicationframehost.exe":
        return "Windows Application"
    if key in APP_NAMES:
        return APP_NAMES[key]
    if executable.lower().endswith(".exe"):
        executable = executable[:-4]
    return executable or "Unknown Application"
