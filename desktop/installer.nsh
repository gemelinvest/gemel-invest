; After an upgrade, tell the shell the executable icon changed so an
; existing desktop shortcut picks up the new ONYX icon.
!macro customInstall
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x1000, p 0, p 0)'
!macroend
