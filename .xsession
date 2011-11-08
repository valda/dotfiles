#!/bin/sh

resources=$HOME/.Xresources

if [ -f "$resources" ]; then
    xrdb -load "$resources"
fi

export LANG=ja_JP.UTF-8
export LC_CTYPE=ja_JP.UTF-8
export LANGUAGE=ja
export GDK_USE_XFT=1

[ -z $GTK_IM_MODULE ] && export GTK_IM_MODULE=ibus
[ -z $QT_IM_MODULE ] && export QT_IM_MODULE=ibus
[ -z $XMODIFIERS ] && export XMODIFIERS="@im=IBUS"

ibus-daemon --xim &

case "`hostname -s`" in
    miyuri)
	#exec fluxbox
	#exec startkde
	export WINDOW_MANAGER=compiz
	exec ssh-agent gnome-session
	;;
    *)
	exec ssh-agent x-window-manager
	;;
esac

