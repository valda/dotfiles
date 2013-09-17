#!/bin/sh

# Make sure this is before the 'exec' command or it won't be sourced.
[ -f /etc/xprofile ] && source /etc/xprofile
[ -f ~/.xprofile ] && source ~/.xprofile
[ -f ~/.Xresources ] && xrdb -load ~/.Xresources

#[ -z $GTK_IM_MODULE ] && export GTK_IM_MODULE=ibus
#[ -z $QT_IM_MODULE ] && export QT_IM_MODULE=ibus
#[ -z $XMODIFIERS ] && export XMODIFIERS="@im=IBUS"
#ibus-daemon --xim &

ssh-agent gnome-session
