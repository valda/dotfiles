#UseHook

; 英語キーボードで変換/無変換を送出する
sc07B::Send,{vk1Dsc07B}
sc079::Send,{vk1Csc079}

;タスクバーでスクロールすると音量調整
#IfWinActive,ahk_class Shell_TrayWnd
WheelUp::Send,{Volume_Up}
WheelDown::Send,{Volume_Down}
MButton::Send,{Volume_Mute}
#IfWinActive
