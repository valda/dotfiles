#!/bin/sh

# Make sure this is before the 'exec' command or it won't be sourced.
[ -f /etc/xprofile ] && . /etc/xprofile
[ -f ~/.xprofile ] && . ~/.xprofile
[ -f ~/.Xresources ] && xrdb -load ~/.Xresources

[ -z $GTK_IM_MODULE ] && export GTK_IM_MODULE=fcitx
[ -z $QT_IM_MODULE ] && export QT_IM_MODULE=fcitx
[ -z $XMODIFIERS ] && export XMODIFIERS="@im=fcitx"
#ibus-daemon --xim &

ssh-agent gnome-session
