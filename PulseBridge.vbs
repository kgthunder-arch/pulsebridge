Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
repoDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.Run Chr(34) & repoDir & "\PulseBridge.cmd" & Chr(34), 1, False

