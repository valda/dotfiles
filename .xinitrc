#!/bin/sh

[ -f ~/.Xresources ] && xrdb -load ~/.Xresources
[ -f ~/.xprofile ] && source ~/.xprofile

[ -z $GTK_IM_MODULE ] && export GTK_IM_MODULE=ibus
[ -z $QT_IM_MODULE ] && export QT_IM_MODULE=ibus
[ -z $XMODIFIERS ] && export XMODIFIERS="@im=IBUS"
ibus-daemon --xim &

case "`hostname -s`" in
    miyuri)
	export WINDOW_MANAGER=compiz
	exec ssh-agent gnome-session
	;;
    *)
	exec ssh-agent x-window-manager
	;;
esac

